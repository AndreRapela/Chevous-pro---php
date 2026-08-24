<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Payments;

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Audit;
use ChezVoust\Core\Controller;
use ChezVoust\Core\Request;
use ChezVoust\Core\Response;
use ChezVoust\Core\Uuid;
use ChezVoust\Core\Validator;
use PDO;

final class PaymentController extends Controller
{
    public function __construct(PDO $db, array $config, private readonly Audit $audit)
    {
        parent::__construct($db, $config);
    }

    public function createIntent(Request $request, array $params, ?array $auth): Response
    {
        $idempotencyKey = trim((string) ($request->headers['idempotency-key'] ?? Uuid::v4()));
        if ($idempotencyKey === '' || strlen($idempotencyKey) > 100) {
            throw new ApiException(422, 'INVALID_IDEMPOTENCY_KEY', 'Chave de idempotência inválida.');
        }

        $this->db->beginTransaction();
        try {
            $booking = $this->requireRow(
                'SELECT b.id, b.public_id, b.customer_id, b.status, b.total_cents, b.currency,
                        sr.status AS slot_status, sr.expires_at AS slot_expires_at,
                        DATE_FORMAT(sr.expires_at, \'%Y-%m-%dT%H:%i:%sZ\') AS slotExpiresAt,
                        CASE WHEN sr.expires_at IS NULL OR sr.expires_at <= UTC_TIMESTAMP() THEN 1 ELSE 0 END AS slot_expired
                 FROM bookings b LEFT JOIN slot_reservations sr ON sr.booking_id = b.id
                 WHERE b.public_id = :id FOR UPDATE',
                ['id' => $params['id']],
                'Reserva não encontrada.'
            );
            if ((int) $booking['customer_id'] !== (int) $auth['id']) {
                throw new ApiException(403, 'FORBIDDEN', 'Somente o cliente pode iniciar o pagamento.');
            }

            $existing = $this->db->prepare(
                'SELECT public_id AS id, status, amount_cents AS amountCents, currency,
                        DATE_FORMAT(expires_at, \'%Y-%m-%dT%H:%i:%sZ\') AS expiresAt
                 FROM payment_intents WHERE booking_id = :booking_id AND idempotency_key = :key LIMIT 1'
            );
            $existing->execute(['booking_id' => $booking['id'], 'key' => $idempotencyKey]);
            $intent = $existing->fetch();

            if ($booking['status'] === 'awaiting_payment'
                && ($booking['slot_status'] !== 'held' || (int) $booking['slot_expired'] === 1)) {
                $this->expireAwaitingBooking((int) $booking['id']);
                $this->db->commit();
                throw new ApiException(409, 'PAYMENT_WINDOW_EXPIRED', 'O prazo para pagamento expirou. Faça uma nova reserva.');
            }
            if ($intent) {
                $this->db->commit();
                $intent['amountCents'] = (int) $intent['amountCents'];
                $intent['driver'] = 'fake';
                $intent['allowedScenarios'] = ['success', 'declined', 'timeout'];
                return Response::data($intent);
            }

            if ($booking['status'] !== 'awaiting_payment') {
                throw new ApiException(409, 'INVALID_BOOKING_STATE', 'A reserva não está aguardando pagamento.');
            }

            $publicId = Uuid::v4();
            $this->db->prepare(
                'INSERT INTO payment_intents
                    (public_id, booking_id, customer_id, status, amount_cents, currency, idempotency_key, expires_at, created_at, updated_at)
                 VALUES (:public_id, :booking_id, :customer_id, \'pending\', :amount, :currency, :key,
                         :expires_at, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
            )->execute([
                'public_id' => $publicId,
                'booking_id' => $booking['id'],
                'customer_id' => $auth['id'],
                'amount' => $booking['total_cents'],
                'currency' => $booking['currency'],
                'key' => $idempotencyKey,
                'expires_at' => $booking['slot_expires_at'],
            ]);
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }

        return Response::data([
            'id' => $publicId, 'status' => 'pending', 'amountCents' => (int) $booking['total_cents'],
            'currency' => $booking['currency'], 'expiresAt' => $booking['slotExpiresAt'],
            'driver' => 'fake', 'allowedScenarios' => ['success', 'declined', 'timeout'],
        ], 201);
    }

    public function show(Request $request, array $params, ?array $auth): Response
    {
        $intent = $this->requireRow(
            'SELECT pi.id AS internalId, pi.public_id AS id, pi.status, pi.amount_cents AS amountCents,
                    pi.currency, pi.failure_code AS failureCode,
                    DATE_FORMAT(pi.expires_at, \'%Y-%m-%dT%H:%i:%sZ\') AS expiresAt,
                    b.customer_id, b.professional_id
             FROM payment_intents pi INNER JOIN bookings b ON b.id = pi.booking_id WHERE pi.public_id = :id',
            ['id' => $params['id']],
            'Pagamento não encontrado.'
        );
        if ($auth['role'] !== 'admin' && (int) $intent['customer_id'] !== (int) $auth['id']
            && (int) ($intent['professional_id'] ?? 0) !== (int) $auth['id']) {
            throw new ApiException(403, 'FORBIDDEN', 'Você não pode consultar este pagamento.');
        }
        unset($intent['internalId'], $intent['customer_id'], $intent['professional_id']);
        return Response::data($intent);
    }

    public function simulate(Request $request, array $params, ?array $auth): Response
    {
        if ($this->config['payment_driver'] !== 'fake') {
            throw new ApiException(404, 'SIMULATOR_DISABLED', 'O simulador de pagamento está desativado.');
        }
        $data = Validator::validate($request->body, ['scenario' => ['required', 'string', 'in:success,declined,timeout']]);
        $this->db->beginTransaction();
        try {
            $statement = $this->db->prepare(
                'SELECT pi.id, pi.public_id, pi.booking_id, pi.customer_id, pi.status, pi.amount_cents, pi.currency,
                        pi.expires_at, b.public_id AS booking_public_id, b.status AS booking_status,
                        b.professional_id, b.coupon_id, sr.status AS slot_status,
                        CASE WHEN pi.expires_at <= UTC_TIMESTAMP() THEN 1 ELSE 0 END AS intent_expired,
                        CASE WHEN sr.expires_at IS NULL OR sr.expires_at <= UTC_TIMESTAMP() THEN 1 ELSE 0 END AS slot_expired
                 FROM payment_intents pi INNER JOIN bookings b ON b.id = pi.booking_id
                 LEFT JOIN slot_reservations sr ON sr.booking_id = b.id
                 WHERE pi.public_id = :id FOR UPDATE'
            );
            $statement->execute(['id' => $params['id']]);
            $intent = $statement->fetch();
            if (!$intent) {
                throw new ApiException(404, 'PAYMENT_NOT_FOUND', 'Pagamento não encontrado.');
            }
            if ((int) $intent['customer_id'] !== (int) $auth['id'] && $auth['role'] !== 'admin') {
                throw new ApiException(403, 'FORBIDDEN', 'Somente o cliente pode confirmar este pagamento.');
            }
            if ($intent['status'] !== 'pending' || $intent['booking_status'] !== 'awaiting_payment') {
                throw new ApiException(409, 'PAYMENT_ALREADY_PROCESSED', 'Este pagamento já foi processado.');
            }
            if ((int) $intent['intent_expired'] === 1 || $intent['slot_status'] !== 'held' || (int) $intent['slot_expired'] === 1) {
                $this->expireAwaitingBooking((int) $intent['booking_id']);
                $this->db->commit();
                throw new ApiException(409, 'PAYMENT_WINDOW_EXPIRED', 'O prazo para pagamento expirou. Faça uma nova reserva.');
            }

            if ($data['scenario'] !== 'success') {
                $failure = $data['scenario'] === 'declined' ? 'card_declined_demo' : 'gateway_timeout_demo';
                $this->db->prepare('UPDATE payment_intents SET status = \'failed\', failure_code = :failure, updated_at = UTC_TIMESTAMP() WHERE id = :id')
                    ->execute(['failure' => $failure, 'id' => $intent['id']]);
                $this->db->prepare(
                    'INSERT INTO payment_transactions
                        (public_id, booking_id, payment_intent_id, type, status, amount_cents, currency, provider_reference, metadata, created_at)
                     VALUES (:public_id, :booking_id, :intent_id, \'charge\', \'failed\', :amount, :currency, :reference, :metadata, UTC_TIMESTAMP())'
                )->execute([
                    'public_id' => Uuid::v4(), 'booking_id' => $intent['booking_id'], 'intent_id' => $intent['id'],
                    'amount' => $intent['amount_cents'], 'currency' => $intent['currency'], 'reference' => 'fake_' . bin2hex(random_bytes(6)),
                    'metadata' => json_encode(['scenario' => $data['scenario'], 'failureCode' => $failure], JSON_THROW_ON_ERROR),
                ]);
                $this->db->commit();
                return Response::data(['id' => $intent['public_id'], 'status' => 'failed', 'failureCode' => $failure], 402);
            }

            if ($intent['coupon_id'] !== null) {
                $coupon = $this->db->prepare(
                    'UPDATE coupons SET used_count = used_count + 1, updated_at = UTC_TIMESTAMP()
                     WHERE id = :id AND active = 1
                       AND (starts_at IS NULL OR starts_at <= UTC_TIMESTAMP())
                       AND (ends_at IS NULL OR ends_at >= UTC_TIMESTAMP())
                       AND (usage_limit IS NULL OR used_count < usage_limit)'
                );
                $coupon->execute(['id' => $intent['coupon_id']]);
                if ($coupon->rowCount() !== 1) {
                    $this->expireAwaitingBooking((int) $intent['booking_id']);
                    $this->db->commit();
                    throw new ApiException(409, 'COUPON_UNAVAILABLE', 'O cupom ficou indisponível antes da confirmação do pagamento.');
                }
            }

            $slot = $this->db->prepare(
                'UPDATE slot_reservations SET status = \'confirmed\', expires_at = NULL
                 WHERE booking_id = :id AND status = \'held\''
            );
            $slot->execute(['id' => $intent['booking_id']]);
            if ($slot->rowCount() !== 1) {
                throw new ApiException(409, 'PAYMENT_WINDOW_EXPIRED', 'O horário reservado não está mais disponível.');
            }

            $reference = 'fake_pay_' . bin2hex(random_bytes(8));
            $payment = $this->db->prepare(
                'UPDATE payment_intents SET status = \'paid\', provider_reference = :reference, paid_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
                 WHERE id = :id AND status = \'pending\''
            );
            $payment->execute(['reference' => $reference, 'id' => $intent['id']]);
            if ($payment->rowCount() !== 1) {
                throw new ApiException(409, 'PAYMENT_ALREADY_PROCESSED', 'Este pagamento já foi processado.');
            }

            $bookingUpdate = $this->db->prepare(
                'UPDATE bookings SET status = \'confirmed\', paid_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
                 WHERE id = :id AND status = \'awaiting_payment\''
            );
            $bookingUpdate->execute(['id' => $intent['booking_id']]);
            if ($bookingUpdate->rowCount() !== 1) {
                throw new ApiException(409, 'INVALID_BOOKING_STATE', 'A situação da reserva foi alterada por outra operação.');
            }
            $this->db->prepare(
                'UPDATE payment_intents SET status = \'cancelled\', failure_code = COALESCE(failure_code, \'superseded\'), updated_at = UTC_TIMESTAMP()
                 WHERE booking_id = :booking_id AND id <> :intent_id AND status = \'pending\''
            )->execute(['booking_id' => $intent['booking_id'], 'intent_id' => $intent['id']]);
            $this->db->prepare(
                'INSERT INTO payment_transactions
                    (public_id, booking_id, payment_intent_id, type, status, amount_cents, currency, provider_reference, metadata, created_at)
                 VALUES (:public_id, :booking_id, :intent_id, \'charge\', \'succeeded\', :amount, :currency, :reference, :metadata, UTC_TIMESTAMP())'
            )->execute([
                'public_id' => Uuid::v4(), 'booking_id' => $intent['booking_id'], 'intent_id' => $intent['id'],
                'amount' => $intent['amount_cents'], 'currency' => $intent['currency'], 'reference' => $reference,
                'metadata' => json_encode(['scenario' => 'success', 'driver' => 'fake'], JSON_THROW_ON_ERROR),
            ]);
            if ($intent['coupon_id'] !== null) {
                $this->db->prepare(
                    'INSERT INTO coupon_redemptions (coupon_id, user_id, booking_id, discount_cents, redeemed_at)
                     SELECT coupon_id, customer_id, id, discount_cents, UTC_TIMESTAMP() FROM bookings WHERE id = :id'
                )->execute(['id' => $intent['booking_id']]);
            }
            $this->db->prepare(
                'INSERT INTO booking_status_history (booking_id, from_status, to_status, actor_id, reason, created_at)
                 VALUES (:booking_id, \'awaiting_payment\', \'confirmed\', :actor_id, \'Pagamento simulado aprovado\', UTC_TIMESTAMP())'
            )->execute(['booking_id' => $intent['booking_id'], 'actor_id' => $auth['id']]);
            if ($intent['professional_id']) {
                $this->notify((int) $intent['professional_id'], 'booking.confirmed', 'Reserva confirmada', 'O pagamento foi aprovado e a reserva está confirmada.', ['bookingId' => $intent['booking_public_id']]);
            }
            $this->notify((int) $intent['customer_id'], 'payment.approved', 'Pagamento aprovado', 'Sua reserva foi confirmada.', ['bookingId' => $intent['booking_public_id']]);
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
        $this->audit->record((int) $auth['id'], 'payment.simulated_success', 'payment_intent', $params['id'], $request);
        return Response::data([
            'id' => $intent['public_id'], 'status' => 'paid', 'bookingId' => $intent['booking_public_id'],
            'bookingStatus' => 'confirmed', 'providerReference' => $reference,
        ]);
    }

    public function index(Request $request, array $params, ?array $auth): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request, 20, 50);
        $where = $auth['role'] === 'admin' ? '1 = 1' : 'pi.customer_id = :user_id';
        $values = $auth['role'] === 'admin' ? [] : ['user_id' => $auth['id']];
        $count = $this->db->prepare("SELECT COUNT(*) FROM payment_intents pi WHERE {$where}");
        $count->execute($values);
        $total = (int) $count->fetchColumn();
        $statement = $this->db->prepare(
            "SELECT pi.public_id AS id, b.public_id AS bookingId, pi.status, pi.amount_cents AS amountCents,
                    pi.currency, pi.failure_code AS failureCode,
                    DATE_FORMAT(pi.paid_at, '%Y-%m-%dT%H:%i:%sZ') AS paidAt,
                    DATE_FORMAT(pi.created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt
             FROM payment_intents pi INNER JOIN bookings b ON b.id = pi.booking_id WHERE {$where}
             ORDER BY pi.created_at DESC LIMIT {$perPage} OFFSET {$offset}"
        );
        $statement->execute($values);
        return Response::data($statement->fetchAll(), 200, ['page' => $page, 'perPage' => $perPage, 'total' => $total, 'lastPage' => max(1, (int) ceil($total / $perPage))]);
    }

    private function expireAwaitingBooking(int $bookingId): void
    {
        $booking = $this->db->prepare(
            'UPDATE bookings SET status = \'cancelled\', cancellation_reason = \'Reserva de pagamento expirada\',
                cancelled_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
             WHERE id = :id AND status = \'awaiting_payment\''
        );
        $booking->execute(['id' => $bookingId]);
        if ($booking->rowCount() !== 1) {
            return;
        }
        $this->db->prepare(
            'UPDATE slot_reservations SET status = \'released\', released_at = UTC_TIMESTAMP()
             WHERE booking_id = :id AND status = \'held\''
        )->execute(['id' => $bookingId]);
        $this->db->prepare(
            'UPDATE payment_intents SET status = \'cancelled\', failure_code = COALESCE(failure_code, \'payment_window_expired\'),
                updated_at = UTC_TIMESTAMP() WHERE booking_id = :id AND status = \'pending\''
        )->execute(['id' => $bookingId]);
        $this->db->prepare(
            'INSERT INTO booking_status_history (booking_id, from_status, to_status, actor_id, reason, created_at)
             VALUES (:booking_id, \'awaiting_payment\', \'cancelled\', NULL, \'Reserva de pagamento expirada\', UTC_TIMESTAMP())'
        )->execute(['booking_id' => $bookingId]);
    }
}
