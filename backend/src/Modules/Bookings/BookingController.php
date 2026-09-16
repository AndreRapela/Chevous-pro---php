<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Bookings;

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Audit;
use ChezVoust\Core\Controller;
use ChezVoust\Core\Request;
use ChezVoust\Core\Response;
use ChezVoust\Core\Uuid;
use ChezVoust\Core\Validator;
use DateTimeImmutable;
use DateTimeZone;
use PDO;

final class BookingController extends Controller
{
    public function __construct(
        PDO $db,
        array $config,
        private readonly PricingService $pricing,
        private readonly Audit $audit
    ) {
        parent::__construct($db, $config);
    }

    public function quote(Request $request, array $params, ?array $auth): Response
    {
        $this->requireVerifiedEmail($auth);
        $data = $this->validatedQuoteInput($this->normalizeInput($request->body));
        $professionalId = null;
        if (!empty($data['professionalId'])) {
            $professional = $this->requireRow(
                'SELECT u.id FROM users u INNER JOIN professional_profiles p ON p.user_id = u.id
                 WHERE u.public_id = :id AND u.status = \'active\' AND p.verification_status = \'approved\'',
                ['id' => $data['professionalId']],
                'Profissional não encontrado.'
            );
            $professionalId = (int) $professional['id'];
        }
        $quote = $this->pricing->quote($data, $professionalId);
        return Response::data($this->publicQuote($quote));
    }

    public function create(Request $request, array $params, ?array $auth): Response
    {
        $this->requireVerifiedEmail($auth);
        $normalizedInput = $this->normalizeInput($request->body);
        $data = Validator::validate($normalizedInput, [
            'serviceId' => ['required', 'uuid'],
            'professionalId' => ['nullable', 'uuid'],
            'addressId' => ['required', 'uuid'],
            'mode' => ['required', 'string', 'in:direct,marketplace'],
            'scheduledStart' => ['required', 'date'],
            'timezone' => ['nullable', 'string', 'max:80'],
            'durationMinutes' => ['nullable', 'integer', 'min:30', 'max:1440'],
            'quantity' => ['nullable', 'numeric', 'min:1', 'max:10000'],
            'areaSqm' => ['nullable', 'numeric', 'min:1', 'max:10000'],
            'addonIds' => ['nullable', 'array', 'max:20'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'currency' => ['required', 'string', 'in:BRL,EUR,USD'],
        ]);
        if ($data['mode'] === 'direct' && empty($data['professionalId'])) {
            throw new ApiException(422, 'PROFESSIONAL_REQUIRED', 'Selecione um profissional para uma reserva direta.');
        }
        if ($data['mode'] === 'marketplace' && !empty($data['professionalId'])) {
            throw new ApiException(422, 'INVALID_BOOKING_MODE', 'Solicitações ao marketplace não devem indicar profissional.');
        }

        $requestHash = hash('sha256', json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
        $idempotencyKey = trim((string) ($request->headers['idempotency-key'] ?? ''));
        if ($idempotencyKey !== '') {
            if (strlen($idempotencyKey) > 100) {
                throw new ApiException(422, 'INVALID_IDEMPOTENCY_KEY', 'Chave de idempotência inválida.');
            }
            $this->db->prepare(
                'DELETE FROM idempotency_keys WHERE user_id = :user_id AND operation = \'booking.create\'
                 AND idempotency_key = :key AND expires_at <= UTC_TIMESTAMP()'
            )->execute(['user_id' => $auth['id'], 'key' => $idempotencyKey]);
            $existing = $this->db->prepare(
                'SELECT request_hash, response_public_id FROM idempotency_keys
                 WHERE user_id = :user_id AND operation = \'booking.create\' AND idempotency_key = :key LIMIT 1'
            );
            $existing->execute(['user_id' => $auth['id'], 'key' => $idempotencyKey]);
            if ($existingRequest = $existing->fetch()) {
                if (!hash_equals((string) $existingRequest['request_hash'], $requestHash)) {
                    throw new ApiException(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outros dados.');
                }
                return $this->show($request, ['id' => $existingRequest['response_public_id']], $auth);
            }
        }

        $address = $this->requireRow(
            'SELECT id, label, street, number, complement, neighborhood, city, state, postal_code
             FROM addresses WHERE public_id = :id AND user_id = :user_id AND deleted_at IS NULL',
            ['id' => $data['addressId'], 'user_id' => $auth['id']],
            'Endereço não encontrado.'
        );
        $timezoneName = (string) ($data['timezone'] ?? $this->config['timezone']);
        try {
            $timezone = new DateTimeZone($timezoneName);
        } catch (\Throwable) {
            throw new ApiException(422, 'INVALID_TIMEZONE', 'Fuso horário inválido.');
        }
        $parsedStart = new DateTimeImmutable((string) $data['scheduledStart'], $timezone);
        $startUtc = $parsedStart->setTimezone(new DateTimeZone('UTC'));
        $startLocal = $startUtc->setTimezone($timezone);
        if ($startUtc->getTimestamp() < time() + 1800 || $startUtc->getTimestamp() > time() + 180 * 86400) {
            throw new ApiException(422, 'INVALID_SCHEDULE', 'Escolha um horário entre 30 minutos e 180 dias a partir de agora.');
        }

        $professional = null;
        if (!empty($data['professionalId'])) {
            $professional = $this->requireRow(
                'SELECT u.id, u.public_id, u.name FROM users u INNER JOIN professional_profiles p ON p.user_id = u.id
                 WHERE u.public_id = :id AND u.status = \'active\' AND p.verification_status = \'approved\'',
                ['id' => $data['professionalId']],
                'Profissional não encontrado.'
            );
        }
        $quote = $this->pricing->quote($data, $professional ? (int) $professional['id'] : null);
        $addressSnapshot = $address;
        unset($addressSnapshot['id']);
        $endUtc = $startUtc->modify('+' . $quote['durationMinutes'] . ' minutes');
        $bookingPublicId = Uuid::v4();
        $status = $data['mode'] === 'direct' ? 'confirmed' : 'open';

        $this->db->beginTransaction();
        try {
            if ($professional) {
                $this->reserveSchedule((int) $professional['id'], $startLocal, $startUtc, $endUtc, null);
            }

            $statement = $this->db->prepare(
                'INSERT INTO bookings
                    (public_id, customer_id, professional_id, service_id, address_id, mode, status,
                     scheduled_start, scheduled_end, timezone, duration_minutes, quantity, area_sqm, notes,
                     address_snapshot, pricing_snapshot, subtotal_cents, discount_cents, service_fee_cents,
                     total_cents, professional_amount_cents, currency, created_at, updated_at)
                 VALUES
                    (:public_id, :customer_id, :professional_id, :service_id, :address_id, :mode, :status,
                     :scheduled_start, :scheduled_end, :timezone, :duration, :quantity, :area, :notes,
                     :address_snapshot, :pricing_snapshot, :subtotal, :discount, :fee, :total, :professional_amount,
                     :currency, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
            );
            $statement->execute([
                'public_id' => $bookingPublicId, 'customer_id' => $auth['id'],
                'professional_id' => $professional['id'] ?? null, 'service_id' => $quote['serviceInternalId'],
                'address_id' => $address['id'], 'mode' => $data['mode'], 'status' => $status,
                'scheduled_start' => $startUtc->format('Y-m-d H:i:s'), 'scheduled_end' => $endUtc->format('Y-m-d H:i:s'),
                'timezone' => $timezoneName, 'duration' => $quote['durationMinutes'], 'quantity' => $quote['quantity'],
                'area' => $quote['areaSqm'], 'notes' => $data['notes'] ?? null,
                'address_snapshot' => json_encode($addressSnapshot, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                'pricing_snapshot' => json_encode($this->publicQuote($quote), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                'subtotal' => $quote['subtotalCents'], 'discount' => $quote['discountCents'], 'fee' => $quote['serviceFeeCents'],
                'total' => $quote['totalCents'], 'professional_amount' => $quote['totalCents'], 'currency' => $quote['currency'],
            ]);
            $bookingId = (int) $this->db->lastInsertId();
            $itemInsert = $this->db->prepare(
                'INSERT INTO booking_items (booking_id, item_type, reference_id, name, quantity, unit_price_cents, total_cents, created_at)
                 VALUES (:booking_id, :type, :reference_id, :name, :quantity, :unit_price, :total, UTC_TIMESTAMP())'
            );
            foreach ($quote['items'] as $item) {
                $itemInsert->execute([
                    'booking_id' => $bookingId, 'type' => $item['type'], 'reference_id' => $item['referenceId'],
                    'name' => $item['name'], 'quantity' => $item['quantity'], 'unit_price' => $item['unitPriceCents'], 'total' => $item['totalCents'],
                ]);
            }
            $this->recordHistory($bookingId, null, $status, (int) $auth['id'], 'Reserva criada');
            $conversationId = $this->createConversation($bookingId, (int) $auth['id'], $professional ? (int) $professional['id'] : null);
            if ($professional) {
                $this->db->prepare(
                    'INSERT INTO slot_reservations (booking_id, professional_id, starts_at, ends_at, status, expires_at, created_at)
                     VALUES (:booking_id, :professional_id, :starts_at, :ends_at, \'confirmed\', NULL, UTC_TIMESTAMP())'
                )->execute([
                    'booking_id' => $bookingId, 'professional_id' => $professional['id'],
                    'starts_at' => $startUtc->format('Y-m-d H:i:s'), 'ends_at' => $endUtc->format('Y-m-d H:i:s'),
                ]);
                $this->notify((int) $professional['id'], 'booking.confirmed', 'Nova reserva confirmada', 'Uma reserva foi confirmada na agenda.', ['bookingId' => $bookingPublicId]);
            }
            if ($idempotencyKey !== '') {
                $this->db->prepare(
                    'INSERT INTO idempotency_keys (user_id, operation, idempotency_key, request_hash, response_public_id, created_at, expires_at)
                     VALUES (:user_id, \'booking.create\', :key, :request_hash, :response_id, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))'
                )->execute([
                    'user_id' => $auth['id'], 'key' => $idempotencyKey,
                    'request_hash' => $requestHash, 'response_id' => $bookingPublicId,
                ]);
            }
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            if ($idempotencyKey !== '' && $exception instanceof \PDOException && $exception->getCode() === '23000') {
                $existing = $this->db->prepare(
                    'SELECT request_hash, response_public_id FROM idempotency_keys
                     WHERE user_id = :user_id AND operation = \'booking.create\' AND idempotency_key = :key LIMIT 1'
                );
                $existing->execute(['user_id' => $auth['id'], 'key' => $idempotencyKey]);
                $stored = $existing->fetch();
                if ($stored) {
                    if (!hash_equals((string) $stored['request_hash'], $requestHash)) {
                        throw new ApiException(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outros dados.');
                    }
                    return $this->show($request, ['id' => $stored['response_public_id']], $auth);
                }
            }
            throw $exception;
        }

        $this->audit->record((int) $auth['id'], 'booking.create', 'booking', $bookingPublicId, $request);
        return $this->show($request, ['id' => $bookingPublicId], $auth, 201);
    }

    public function index(Request $request, array $params, ?array $auth): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request, 20, 50);
        $where = match ($auth['role']) {
            'provider' => 'b.professional_id = :user_id',
            'admin' => '1 = 1',
            default => 'b.customer_id = :user_id',
        };
        $values = $auth['role'] === 'admin' ? [] : ['user_id' => $auth['id']];
        if (!empty($request->query['status'])) {
            $where .= ' AND b.status = :status';
            $values['status'] = (string) $request->query['status'];
        }
        $count = $this->db->prepare("SELECT COUNT(*) FROM bookings b WHERE {$where}");
        $count->execute($values);
        $total = (int) $count->fetchColumn();
        $statement = $this->db->prepare(
            "SELECT b.public_id AS id, b.mode, b.status, b.duration_minutes AS durationMinutes, b.notes,
                    DATE_FORMAT(b.scheduled_start, '%Y-%m-%dT%H:%i:%sZ') AS scheduledStart,
                    DATE_FORMAT(b.scheduled_end, '%Y-%m-%dT%H:%i:%sZ') AS scheduledEnd,
                    b.subtotal_cents AS subtotalCents, b.discount_cents AS discountCents,
                    b.service_fee_cents AS serviceFeeCents, b.total_cents AS totalCents, b.currency,
                    b.address_snapshot AS addressSnapshot, b.pricing_snapshot AS pricingSnapshot,
                    s.public_id AS serviceId, s.name AS serviceName,
                    p.public_id AS professionalId, p.name AS professionalName,
                    c.public_id AS customerId, c.name AS customerName,
                    cv.public_id AS conversationId, r.id AS reviewInternalId
             FROM bookings b INNER JOIN services s ON s.id = b.service_id
             INNER JOIN users c ON c.id = b.customer_id LEFT JOIN users p ON p.id = b.professional_id
             LEFT JOIN conversations cv ON cv.booking_id = b.id LEFT JOIN reviews r ON r.booking_id = b.id
             WHERE {$where} ORDER BY b.created_at DESC LIMIT {$perPage} OFFSET {$offset}"
        );
        $statement->execute($values);
        $rows = $statement->fetchAll();
        foreach ($rows as &$row) {
            $row['addressSnapshot'] = json_decode((string) $row['addressSnapshot'], true);
            $row['pricingSnapshot'] = json_decode((string) $row['pricingSnapshot'], true);
            $row['allowedActions'] = $this->allowedActions(
                (string) $auth['role'],
                (string) $row['status'],
                $row['conversationId'] !== null,
                $row['reviewInternalId'] !== null
            );
            unset($row['reviewInternalId']);
        }
        unset($row);
        return Response::data($rows, 200, [
            'page' => $page, 'perPage' => $perPage, 'total' => $total, 'lastPage' => max(1, (int) ceil($total / $perPage)),
        ]);
    }

    public function show(Request $request, array $params, ?array $auth, int $status = 200): Response
    {
        $booking = $this->requireRow(
            'SELECT b.id AS internalId, b.public_id AS id, b.customer_id AS customerInternalId,
                    b.professional_id AS professionalInternalId, b.mode, b.status,
                    DATE_FORMAT(b.scheduled_start, \'%Y-%m-%dT%H:%i:%sZ\') AS scheduledStart,
                    DATE_FORMAT(b.scheduled_end, \'%Y-%m-%dT%H:%i:%sZ\') AS scheduledEnd, b.timezone,
                    b.duration_minutes AS durationMinutes, b.quantity, b.area_sqm AS areaSqm, b.notes,
                    b.subtotal_cents AS subtotalCents, b.discount_cents AS discountCents,
                    b.service_fee_cents AS serviceFeeCents, b.total_cents AS totalCents, b.currency,
                    b.address_snapshot AS addressSnapshot, b.pricing_snapshot AS pricingSnapshot,
                    DATE_FORMAT(b.created_at, \'%Y-%m-%dT%H:%i:%sZ\') AS createdAt,
                    DATE_FORMAT(b.updated_at, \'%Y-%m-%dT%H:%i:%sZ\') AS updatedAt,
                    s.public_id AS serviceId, s.name AS serviceName,
                    c.public_id AS customerId, c.name AS customerName,
                    p.public_id AS professionalId, p.name AS professionalName,
                    cv.public_id AS conversationId,
                    EXISTS(SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS hasReview
             FROM bookings b INNER JOIN services s ON s.id = b.service_id
             INNER JOIN users c ON c.id = b.customer_id LEFT JOIN users p ON p.id = b.professional_id
             LEFT JOIN conversations cv ON cv.booking_id = b.id WHERE b.public_id = :id',
            ['id' => $params['id']],
            'Reserva não encontrada.'
        );
        if ($auth['role'] !== 'admin'
            && (int) $booking['customerInternalId'] !== (int) $auth['id']
            && (int) ($booking['professionalInternalId'] ?? 0) !== (int) $auth['id']) {
            throw new ApiException(403, 'FORBIDDEN', 'Você não participa desta reserva.');
        }
        $booking['addressSnapshot'] = json_decode((string) $booking['addressSnapshot'], true);
        $booking['pricingSnapshot'] = json_decode((string) $booking['pricingSnapshot'], true);
        $booking['allowedActions'] = $this->allowedActions(
            (string) $auth['role'],
            (string) $booking['status'],
            $booking['conversationId'] !== null,
            (bool) $booking['hasReview']
        );
        $history = $this->db->prepare(
            'SELECT from_status AS fromStatus, to_status AS toStatus, reason,
                    DATE_FORMAT(created_at, \'%Y-%m-%dT%H:%i:%sZ\') AS createdAt
             FROM booking_status_history WHERE booking_id = :booking_id ORDER BY id ASC'
        );
        $history->execute(['booking_id' => $booking['internalId']]);
        $booking['history'] = $history->fetchAll();
        unset($booking['hasReview']);
        unset($booking['internalId'], $booking['customerInternalId'], $booking['professionalInternalId']);
        return Response::data($booking, $status);
    }

    public function offers(Request $request, array $params, ?array $auth): Response
    {
        $booking = $this->requireRow('SELECT id, customer_id FROM bookings WHERE public_id = :id', ['id' => $params['id']], 'Reserva não encontrada.');
        if ((int) $booking['customer_id'] !== (int) $auth['id'] && $auth['role'] !== 'admin') {
            throw new ApiException(403, 'FORBIDDEN', 'Somente o cliente pode consultar estas propostas.');
        }
        $statement = $this->db->prepare(
            'SELECT o.public_id AS id, o.amount_cents AS amountCents, o.message, o.status,
                    DATE_FORMAT(o.expires_at, \'%Y-%m-%dT%H:%i:%sZ\') AS expiresAt,
                    DATE_FORMAT(o.created_at, \'%Y-%m-%dT%H:%i:%sZ\') AS createdAt,
                    u.public_id AS professionalId, u.name AS professionalName,
                    p.rating_avg AS rating, p.reviews_count AS reviewsCount, p.verification_status AS verificationStatus
             FROM booking_offers o INNER JOIN users u ON u.id = o.professional_id
             INNER JOIN professional_profiles p ON p.user_id = u.id WHERE o.booking_id = :id ORDER BY o.created_at DESC'
        );
        $statement->execute(['id' => $booking['id']]);
        return Response::data($statement->fetchAll());
    }

    public function acceptOffer(Request $request, array $params, ?array $auth): Response
    {
        $this->requireVerifiedEmail($auth);
        $this->db->beginTransaction();
        try {
            $statement = $this->db->prepare(
                'SELECT o.id AS offer_id, o.booking_id, o.professional_id, o.amount_cents,
                        b.public_id AS booking_public_id, b.customer_id, b.status, b.scheduled_start,
                        b.scheduled_end, b.timezone, b.discount_cents
                 FROM booking_offers o INNER JOIN bookings b ON b.id = o.booking_id
                 INNER JOIN users provider_user ON provider_user.id = o.professional_id AND provider_user.status = \'active\'
                 INNER JOIN professional_profiles provider_profile
                    ON provider_profile.user_id = o.professional_id AND provider_profile.verification_status = \'approved\'
                 WHERE o.public_id = :offer AND o.status = \'pending\' AND o.expires_at > UTC_TIMESTAMP() FOR UPDATE'
            );
            $statement->execute(['offer' => $params['offerId']]);
            $offer = $statement->fetch();
            if (!$offer) {
                throw new ApiException(404, 'OFFER_NOT_FOUND', 'Proposta não encontrada ou expirada.');
            }
            if (isset($params['id']) && $params['id'] !== $offer['booking_public_id']) {
                throw new ApiException(404, 'OFFER_NOT_FOUND', 'A proposta não pertence a esta reserva.');
            }
            if ((int) $offer['customer_id'] !== (int) $auth['id'] || $offer['status'] !== 'open') {
                throw new ApiException(403, 'OFFER_NOT_AVAILABLE', 'Esta proposta não pode mais ser aceita.');
            }
            $startUtc = new DateTimeImmutable($offer['scheduled_start'], new DateTimeZone('UTC'));
            $endUtc = new DateTimeImmutable($offer['scheduled_end'], new DateTimeZone('UTC'));
            $startLocal = $startUtc->setTimezone(new DateTimeZone($offer['timezone']));
            $this->reserveSchedule((int) $offer['professional_id'], $startLocal, $startUtc, $endUtc, (int) $offer['booking_id']);

            $fee = 0;
            $discount = 0;
            $total = (int) $offer['amount_cents'];
            $professionalAmount = $total;
            $this->db->prepare(
                'UPDATE bookings SET professional_id = :professional_id, status = \'confirmed\',
                    subtotal_cents = :subtotal, service_fee_cents = :fee, total_cents = :total,
                    professional_amount_cents = :professional_amount, updated_at = UTC_TIMESTAMP() WHERE id = :id'
            )->execute([
                'professional_id' => $offer['professional_id'], 'subtotal' => $offer['amount_cents'], 'fee' => $fee,
                'total' => $total, 'professional_amount' => $professionalAmount, 'id' => $offer['booking_id'],
            ]);
            $this->db->prepare('UPDATE booking_offers SET status = IF(id = :offer_id, \'accepted\', \'rejected\'), updated_at = UTC_TIMESTAMP() WHERE booking_id = :booking_id AND status = \'pending\'')
                ->execute(['offer_id' => $offer['offer_id'], 'booking_id' => $offer['booking_id']]);
            $this->db->prepare(
                'INSERT INTO slot_reservations (booking_id, professional_id, starts_at, ends_at, status, expires_at, created_at)
                 VALUES (:booking_id, :professional_id, :starts, :ends, \'confirmed\', NULL, UTC_TIMESTAMP())'
            )->execute([
                'booking_id' => $offer['booking_id'], 'professional_id' => $offer['professional_id'],
                'starts' => $offer['scheduled_start'], 'ends' => $offer['scheduled_end'],
            ]);
            $conversation = $this->db->prepare('SELECT id FROM conversations WHERE booking_id = :booking_id');
            $conversation->execute(['booking_id' => $offer['booking_id']]);
            $conversationId = (int) $conversation->fetchColumn();
            $this->db->prepare(
                'INSERT IGNORE INTO conversation_participants (conversation_id, user_id, joined_at) VALUES (:conversation_id, :user_id, UTC_TIMESTAMP())'
            )->execute(['conversation_id' => $conversationId, 'user_id' => $offer['professional_id']]);
            $this->recordHistory((int) $offer['booking_id'], 'open', 'confirmed', (int) $auth['id'], 'Proposta aceita e reserva confirmada');
            $this->notify((int) $offer['professional_id'], 'offer.accepted', 'Proposta aceita', 'O cliente aceitou sua proposta.', ['bookingId' => $offer['booking_public_id']]);
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
        return $this->show($request, ['id' => $offer['booking_public_id']], $auth);
    }

    public function cancel(Request $request, array $params, ?array $auth): Response
    {
        $this->requireVerifiedEmail($auth);
        $data = Validator::validate($request->body, ['reason' => ['required', 'string', 'min:3', 'max:500']]);
        $this->db->beginTransaction();
        try {
            $booking = $this->requireRow(
                'SELECT id, public_id, customer_id, professional_id, status
                 FROM bookings WHERE public_id = :id FOR UPDATE',
                ['id' => $params['id']],
                'Reserva não encontrada.'
            );
            if ($auth['role'] !== 'admin'
                && (int) $booking['customer_id'] !== (int) $auth['id']
                && (int) ($booking['professional_id'] ?? 0) !== (int) $auth['id']) {
                throw new ApiException(403, 'FORBIDDEN', 'Você não participa desta reserva.');
            }
            if (!in_array($booking['status'], ['open', 'confirmed'], true)) {
                throw new ApiException(409, 'INVALID_BOOKING_STATE', 'Esta reserva não pode mais ser cancelada.');
            }
            $oldStatus = $booking['status'];
            $newStatus = 'cancelled';
            $this->db->prepare(
                'UPDATE bookings SET status = :status, cancellation_reason = :reason, cancelled_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = :id'
            )->execute(['status' => $newStatus, 'reason' => $data['reason'], 'id' => $booking['id']]);
            $this->db->prepare('UPDATE slot_reservations SET status = \'released\', released_at = UTC_TIMESTAMP() WHERE booking_id = :id AND status <> \'released\'')
                ->execute(['id' => $booking['id']]);
            $this->db->prepare('UPDATE booking_offers SET status = \'rejected\', updated_at = UTC_TIMESTAMP() WHERE booking_id = :id AND status = \'pending\'')
                ->execute(['id' => $booking['id']]);
            $this->recordHistory((int) $booking['id'], $oldStatus, $newStatus, (int) $auth['id'], $data['reason']);
            $recipient = (int) $booking['customer_id'] === (int) $auth['id'] ? $booking['professional_id'] : $booking['customer_id'];
            if ($recipient) {
                $this->notify((int) $recipient, 'booking.cancelled', 'Reserva cancelada', 'A reserva foi cancelada.', ['bookingId' => $booking['public_id']]);
            }
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
        return $this->show($request, ['id' => $params['id']], $auth);
    }

    public function start(Request $request, array $params, ?array $auth): Response
    {
        $this->requireVerifiedEmail($auth);
        return $this->transition($request, $params['id'], $auth, ['confirmed', 'provider_on_the_way'], 'in_progress', 'Serviço iniciado');
    }

    public function onTheWay(Request $request, array $params, ?array $auth): Response
    {
        $this->requireVerifiedEmail($auth);
        return $this->transition($request, $params['id'], $auth, 'confirmed', 'provider_on_the_way', 'Profissional a caminho');
    }

    public function complete(Request $request, array $params, ?array $auth): Response
    {
        $this->requireVerifiedEmail($auth);
        return $this->transition($request, $params['id'], $auth, 'in_progress', 'completed', 'Serviço concluído');
    }

    public function reschedule(Request $request, array $params, ?array $auth): Response
    {
        $this->requireVerifiedEmail($auth);
        $data = Validator::validate($request->body, [
            'scheduledStart' => ['required', 'date'],
            'timezone' => ['nullable', 'string', 'max:80'],
        ]);
        $timezoneName = (string) ($data['timezone'] ?? $this->config['timezone']);
        try {
            $timezone = new DateTimeZone($timezoneName);
            $startUtc = (new DateTimeImmutable((string) $data['scheduledStart'], $timezone))->setTimezone(new DateTimeZone('UTC'));
        } catch (\Throwable) {
            throw new ApiException(422, 'INVALID_SCHEDULE', 'Data, horário ou fuso horário inválido.');
        }
        if ($startUtc->getTimestamp() < time() + 1800 || $startUtc->getTimestamp() > time() + 180 * 86400) {
            throw new ApiException(422, 'INVALID_SCHEDULE', 'Escolha um horário entre 30 minutos e 180 dias a partir de agora.');
        }

        $this->db->beginTransaction();
        try {
            $booking = $this->requireRow(
                'SELECT id, public_id, customer_id, professional_id, status, duration_minutes
                 FROM bookings WHERE public_id = :id FOR UPDATE',
                ['id' => $params['id']],
                'Reserva não encontrada.'
            );
            if ($auth['role'] !== 'admin' && (int) $booking['customer_id'] !== (int) $auth['id']) {
                throw new ApiException(403, 'FORBIDDEN', 'Somente o cliente responsável pode reagendar esta reserva.');
            }
            if ($booking['status'] !== 'confirmed' || $booking['professional_id'] === null) {
                throw new ApiException(409, 'INVALID_BOOKING_STATE', 'Somente reservas confirmadas com profissional definido podem ser reagendadas.');
            }
            $startLocal = $startUtc->setTimezone($timezone);
            $endUtc = $startUtc->modify('+' . (int) $booking['duration_minutes'] . ' minutes');
            $this->reserveSchedule((int) $booking['professional_id'], $startLocal, $startUtc, $endUtc, (int) $booking['id']);
            $this->db->prepare(
                'UPDATE bookings SET scheduled_start = :starts_at, scheduled_end = :ends_at, timezone = :timezone,
                    updated_at = UTC_TIMESTAMP() WHERE id = :id AND status = \'confirmed\''
            )->execute([
                'starts_at' => $startUtc->format('Y-m-d H:i:s'),
                'ends_at' => $endUtc->format('Y-m-d H:i:s'),
                'timezone' => $timezoneName,
                'id' => $booking['id'],
            ]);
            $this->db->prepare(
                'UPDATE slot_reservations SET starts_at = :starts_at, ends_at = :ends_at, status = \'confirmed\',
                    expires_at = NULL, released_at = NULL WHERE booking_id = :booking_id'
            )->execute([
                'starts_at' => $startUtc->format('Y-m-d H:i:s'),
                'ends_at' => $endUtc->format('Y-m-d H:i:s'),
                'booking_id' => $booking['id'],
            ]);
            $this->recordHistory((int) $booking['id'], 'confirmed', 'confirmed', (int) $auth['id'], 'Reserva reagendada');
            $this->notify((int) $booking['professional_id'], 'booking.rescheduled', 'Reserva reagendada', 'O cliente escolheu um novo horário.', ['bookingId' => $booking['public_id']]);
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
        $this->audit->record((int) $auth['id'], 'booking.reschedule', 'booking', (string) $params['id'], $request);
        return $this->show($request, ['id' => $params['id']], $auth);
    }

    private function transition(Request $request, string $bookingPublicId, array $auth, string|array $from, string $to, string $reason): Response
    {
        $this->db->beginTransaction();
        try {
            $booking = $this->requireRow(
                'SELECT id, public_id, customer_id, professional_id, status
                 FROM bookings WHERE public_id = :id FOR UPDATE',
                ['id' => $bookingPublicId],
                'Reserva não encontrada.'
            );
            if ($auth['role'] !== 'admin' && (int) ($booking['professional_id'] ?? 0) !== (int) $auth['id']) {
                throw new ApiException(403, 'FORBIDDEN', 'Somente o profissional responsável pode realizar esta ação.');
            }

            $alreadyApplied = $booking['status'] === $to;
            if (!$alreadyApplied) {
                $allowedFrom = is_array($from) ? $from : [$from];
                if (!in_array($booking['status'], $allowedFrom, true)) {
                    throw new ApiException(409, 'INVALID_BOOKING_STATE', 'A reserva não está no estado esperado para esta ação.');
                }
                $actualFrom = (string) $booking['status'];
                $update = $this->db->prepare(
                    'UPDATE bookings SET status = :status, updated_at = UTC_TIMESTAMP(),
                        completed_at = IF(:completed_status = \'completed\', UTC_TIMESTAMP(), completed_at)
                     WHERE id = :id AND status = :expected_status'
                );
                $update->execute([
                    'status' => $to,
                    'completed_status' => $to,
                    'id' => $booking['id'],
                    'expected_status' => $actualFrom,
                ]);
                if ($update->rowCount() !== 1) {
                    throw new ApiException(409, 'INVALID_BOOKING_STATE', 'A situação da reserva foi alterada por outra operação.');
                }
                if ($to === 'completed') {
                    $this->db->prepare('UPDATE professional_profiles SET completed_jobs = completed_jobs + 1, updated_at = UTC_TIMESTAMP() WHERE user_id = :id')
                        ->execute(['id' => $booking['professional_id']]);
                    $this->db->prepare('UPDATE slot_reservations SET status = \'released\', released_at = UTC_TIMESTAMP() WHERE booking_id = :id')
                        ->execute(['id' => $booking['id']]);
                }
                $this->recordHistory((int) $booking['id'], $actualFrom, $to, (int) $auth['id'], $reason);
                $this->notify((int) $booking['customer_id'], 'booking.' . $to, $reason, 'A situação da sua reserva foi atualizada.', ['bookingId' => $bookingPublicId]);
            }
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
        return $this->show($request, ['id' => $bookingPublicId], $auth);
    }

    private function validatedQuoteInput(array $body): array
    {
        return Validator::validate($body, [
            'serviceId' => ['required', 'uuid'], 'professionalId' => ['nullable', 'uuid'],
            'durationMinutes' => ['nullable', 'integer', 'min:30', 'max:1440'],
            'quantity' => ['nullable', 'numeric', 'min:1', 'max:10000'],
            'areaSqm' => ['nullable', 'numeric', 'min:1', 'max:10000'],
            'addonIds' => ['nullable', 'array', 'max:20'],
            'currency' => ['required', 'string', 'in:BRL,EUR,USD'],
        ]);
    }

    private function normalizeInput(array $body): array
    {
        if (!isset($body['professionalId']) && isset($body['providerId'])) {
            $body['professionalId'] = $body['providerId'];
        }
        if (!isset($body['durationMinutes']) && isset($body['estimatedMinutes'])) {
            $body['durationMinutes'] = $body['estimatedMinutes'];
        }
        if (!isset($body['addonIds']) && isset($body['extras'])) {
            $body['addonIds'] = $body['extras'];
        }
        if (!isset($body['areaSqm']) && isset($body['answers']['areaM2'])) {
            $body['areaSqm'] = $body['answers']['areaM2'];
        }
        if (($body['mode'] ?? null) === 'request') {
            $body['mode'] = 'marketplace';
        }
        return $body;
    }

    private function publicQuote(array $quote): array
    {
        unset($quote['serviceInternalId']);
        foreach ($quote['items'] as &$item) {
            unset($item['referenceId']);
        }
        unset($item);
        return $quote;
    }

    private function reserveSchedule(int $professionalId, DateTimeImmutable $startLocal, DateTimeImmutable $startUtc, DateTimeImmutable $endUtc, ?int $ignoreBookingId): void
    {
        $date = $startLocal->format('Y-m-d');
        $this->db->prepare(
            'INSERT INTO schedule_day_locks (professional_id, work_date, updated_at)
             VALUES (:professional_id, :work_date, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE updated_at = updated_at'
        )->execute(['professional_id' => $professionalId, 'work_date' => $date]);
        $lock = $this->db->prepare('SELECT professional_id FROM schedule_day_locks WHERE professional_id = :professional_id AND work_date = :work_date FOR UPDATE');
        $lock->execute(['professional_id' => $professionalId, 'work_date' => $date]);

        $rule = $this->db->prepare(
            'SELECT 1 FROM availability_rules WHERE professional_id = :professional_id AND weekday = :weekday AND active = 1
             AND start_time <= :start_time AND end_time >= :end_time LIMIT 1'
        );
        $rule->execute([
            'professional_id' => $professionalId, 'weekday' => (int) $startLocal->format('w'),
            'start_time' => $startLocal->format('H:i:s'), 'end_time' => $endUtc->setTimezone($startLocal->getTimezone())->format('H:i:s'),
        ]);
        if (!$rule->fetchColumn()) {
            throw new ApiException(422, 'PROFESSIONAL_UNAVAILABLE', 'O profissional não atende nesse horário.');
        }
        $exception = $this->db->prepare(
            'SELECT 1 FROM availability_exceptions WHERE professional_id = :professional_id AND exception_date = :date
             AND type = \'unavailable\' AND (start_time IS NULL OR (start_time < :end_time AND end_time > :start_time)) LIMIT 1'
        );
        $exception->execute([
            'professional_id' => $professionalId, 'date' => $date,
            'start_time' => $startLocal->format('H:i:s'), 'end_time' => $endUtc->setTimezone($startLocal->getTimezone())->format('H:i:s'),
        ]);
        if ($exception->fetchColumn()) {
            throw new ApiException(422, 'PROFESSIONAL_UNAVAILABLE', 'O profissional está indisponível nesse horário.');
        }
        $conflictSql =
            'SELECT 1 FROM bookings b WHERE b.professional_id = :professional_id
             AND b.status IN (\'confirmed\', \'provider_on_the_way\', \'in_progress\')
             AND b.scheduled_start < :ends_at AND b.scheduled_end > :starts_at';
        $values = [
            'professional_id' => $professionalId, 'starts_at' => $startUtc->format('Y-m-d H:i:s'), 'ends_at' => $endUtc->format('Y-m-d H:i:s'),
        ];
        if ($ignoreBookingId !== null) {
            $conflictSql .= ' AND b.id <> :ignore_id';
            $values['ignore_id'] = $ignoreBookingId;
        }
        $conflictSql .= ' LIMIT 1';
        $conflict = $this->db->prepare($conflictSql);
        $conflict->execute($values);
        if ($conflict->fetchColumn()) {
            throw new ApiException(409, 'SCHEDULE_CONFLICT', 'Este horário acabou de ficar indisponível.');
        }
    }

    private function createConversation(int $bookingId, int $customerId, ?int $professionalId): int
    {
        $publicId = Uuid::v4();
        $this->db->prepare('INSERT INTO conversations (public_id, booking_id, created_at, updated_at) VALUES (:public_id, :booking_id, UTC_TIMESTAMP(), UTC_TIMESTAMP())')
            ->execute(['public_id' => $publicId, 'booking_id' => $bookingId]);
        $conversationId = (int) $this->db->lastInsertId();
        $insert = $this->db->prepare('INSERT INTO conversation_participants (conversation_id, user_id, joined_at) VALUES (:conversation_id, :user_id, UTC_TIMESTAMP())');
        $insert->execute(['conversation_id' => $conversationId, 'user_id' => $customerId]);
        if ($professionalId !== null) {
            $insert->execute(['conversation_id' => $conversationId, 'user_id' => $professionalId]);
        }
        return $conversationId;
    }

    private function recordHistory(int $bookingId, ?string $from, string $to, ?int $actorId, string $reason): void
    {
        $this->db->prepare(
            'INSERT INTO booking_status_history (booking_id, from_status, to_status, actor_id, reason, created_at)
             VALUES (:booking_id, :from_status, :to_status, :actor_id, :reason, UTC_TIMESTAMP())'
        )->execute(['booking_id' => $bookingId, 'from_status' => $from, 'to_status' => $to, 'actor_id' => $actorId, 'reason' => $reason]);
    }

    private function allowedActions(string $role, string $status, bool $hasConversation, bool $hasReview): array
    {
        $actions = [];
        if (in_array($status, ['open', 'confirmed'], true)) {
            $actions[] = 'cancel';
        }
        if ($role === 'customer' && $status === 'completed' && !$hasReview) {
            $actions[] = 'review';
        }
        if ($role === 'customer' && $status === 'open') {
            $actions[] = 'offers';
        }
        if ($role === 'customer' && $status === 'confirmed') {
            $actions[] = 'reschedule';
        }
        if (in_array($role, ['provider', 'admin'], true) && $status === 'confirmed') {
            $actions[] = 'on_the_way';
        }
        if (in_array($role, ['provider', 'admin'], true) && in_array($status, ['confirmed', 'provider_on_the_way'], true)) {
            $actions[] = 'start';
        }
        if (in_array($role, ['provider', 'admin'], true) && $status === 'in_progress') {
            $actions[] = 'complete';
        }
        if ($hasConversation) {
            $actions[] = 'message';
        }
        return $actions;
    }
}
