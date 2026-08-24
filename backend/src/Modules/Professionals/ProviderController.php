<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Professionals;

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Controller;
use ChezVoust\Core\Request;
use ChezVoust\Core\Response;
use ChezVoust\Core\Uuid;
use ChezVoust\Core\Validator;

final class ProviderController extends Controller
{
    public function dashboard(Request $request, array $params, ?array $auth): Response
    {
        $statement = $this->db->prepare(
            'SELECT
                SUM(status = \'confirmed\' AND scheduled_start >= UTC_TIMESTAMP()) AS upcomingJobs,
                SUM(status = \'completed\') AS completedJobs,
                COALESCE(SUM(CASE WHEN status = \'completed\' THEN professional_amount_cents ELSE 0 END), 0) AS earningsCents
             FROM bookings WHERE professional_id = :id'
        );
        $statement->execute(['id' => $auth['id']]);
        $metrics = $statement->fetch();
        $requests = $this->db->prepare(
            'SELECT COUNT(DISTINCT b.id) FROM bookings b
             INNER JOIN professional_services ps ON ps.service_id = b.service_id
                AND ps.professional_id = :professional_id AND ps.active = 1
             WHERE b.status = \'open\' AND b.mode = \'marketplace\''
        );
        $requests->execute(['professional_id' => $auth['id']]);
        $metrics['openRequests'] = (int) $requests->fetchColumn();
        $profile = $this->profile($request, [], $auth)->payload['data'];
        return Response::data(['metrics' => $metrics, 'profile' => $profile]);
    }

    public function profile(Request $request, array $params, ?array $auth): Response
    {
        $row = $this->requireRow(
            'SELECT u.public_id AS id, u.name, u.email, u.phone, p.headline, p.bio,
                    p.years_experience AS yearsExperience, p.base_city AS baseCity, p.base_state AS baseState,
                    p.service_radius_km AS serviceRadiusKm, p.verification_status AS verificationStatus,
                    p.verification_notes AS verificationNotes, p.rating_avg AS rating,
                    p.reviews_count AS reviewsCount, p.completed_jobs AS completedJobs
             FROM users u INNER JOIN professional_profiles p ON p.user_id = u.id WHERE u.id = :id',
            ['id' => $auth['id']]
        );
        return Response::data($row);
    }

    public function updateProfile(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, [
            'headline' => ['sometimes', 'nullable', 'string', 'max:160'],
            'bio' => ['sometimes', 'nullable', 'string', 'max:3000'],
            'yearsExperience' => ['sometimes', 'integer', 'min:0', 'max:60'],
            'baseCity' => ['sometimes', 'nullable', 'string', 'max:100'],
            'baseState' => ['sometimes', 'nullable', 'string', 'max:2'],
            'serviceRadiusKm' => ['sometimes', 'integer', 'min:1', 'max:300'],
        ]);
        if ($data === []) {
            throw new ApiException(422, 'NO_CHANGES', 'Informe ao menos um campo para atualizar.');
        }
        $map = [
            'headline' => 'headline', 'bio' => 'bio', 'yearsExperience' => 'years_experience',
            'baseCity' => 'base_city', 'baseState' => 'base_state', 'serviceRadiusKm' => 'service_radius_km',
        ];
        $sets = [];
        $values = ['id' => $auth['id']];
        foreach ($data as $field => $value) {
            $sets[] = $map[$field] . ' = :' . $field;
            $values[$field] = $field === 'baseState' && $value !== null ? strtoupper((string) $value) : $value;
        }
        $this->db->prepare('UPDATE professional_profiles SET ' . implode(', ', $sets) . ', updated_at = UTC_TIMESTAMP() WHERE user_id = :id')
            ->execute($values);
        return $this->profile($request, [], $auth);
    }

    public function services(Request $request, array $params, ?array $auth): Response
    {
        $statement = $this->db->prepare(
            'SELECT s.public_id AS id, s.name, s.slug, s.pricing_type AS pricingType,
                    s.price_cents AS catalogPriceCents, ps.price_cents AS customPriceCents, ps.active
             FROM professional_services ps INNER JOIN services s ON s.id = ps.service_id
             WHERE ps.professional_id = :id ORDER BY s.name'
        );
        $statement->execute(['id' => $auth['id']]);
        return Response::data($statement->fetchAll());
    }

    public function upsertService(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, [
            'priceCents' => ['nullable', 'integer', 'min:1000', 'max:10000000'],
            'active' => ['sometimes', 'boolean'],
        ]);
        $service = $this->requireRow('SELECT id FROM services WHERE public_id = :id AND active = 1', ['id' => $params['serviceId']], 'Serviço não encontrado.');
        $this->db->prepare(
            'INSERT INTO professional_services (professional_id, service_id, price_cents, active, created_at, updated_at)
             VALUES (:professional_id, :service_id, :price, :active, UTC_TIMESTAMP(), UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE price_cents = VALUES(price_cents), active = VALUES(active), updated_at = UTC_TIMESTAMP()'
        )->execute([
            'professional_id' => $auth['id'],
            'service_id' => $service['id'],
            'price' => $data['priceCents'] ?? null,
            'active' => isset($data['active']) ? (int) (bool) $data['active'] : 1,
        ]);
        $updated = $this->requireRow(
            'SELECT s.public_id AS id, s.name, s.slug, s.pricing_type AS pricingType,
                    s.price_cents AS catalogPriceCents, ps.price_cents AS customPriceCents, ps.active
             FROM professional_services ps INNER JOIN services s ON s.id = ps.service_id
             WHERE ps.professional_id = :professional_id AND s.id = :service_id',
            ['professional_id' => $auth['id'], 'service_id' => $service['id']]
        );
        return Response::data($updated);
    }

    public function removeService(Request $request, array $params, ?array $auth): Response
    {
        $statement = $this->db->prepare(
            'UPDATE professional_services ps INNER JOIN services s ON s.id = ps.service_id
             SET ps.active = 0, ps.updated_at = UTC_TIMESTAMP()
             WHERE ps.professional_id = :professional_id AND s.public_id = :service_id'
        );
        $statement->execute(['professional_id' => $auth['id'], 'service_id' => $params['serviceId']]);
        return Response::noContent();
    }

    public function availability(Request $request, array $params, ?array $auth): Response
    {
        $rules = $this->db->prepare(
            'SELECT public_id AS id, weekday, TIME_FORMAT(start_time, \'%H:%i\') AS startTime,
                    TIME_FORMAT(end_time, \'%H:%i\') AS endTime
             FROM availability_rules WHERE professional_id = :id AND active = 1 ORDER BY weekday, start_time'
        );
        $rules->execute(['id' => $auth['id']]);
        return Response::data($rules->fetchAll());
    }

    public function replaceAvailability(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, ['rules' => ['required', 'array', 'max:28']]);
        $normalized = [];
        foreach ($data['rules'] as $index => $rule) {
            if (!is_array($rule)) {
                throw new ApiException(422, 'VALIDATION_ERROR', 'Regra de disponibilidade inválida.', ['rules' => ["Item {$index} inválido."]]);
            }
            $item = Validator::validate($rule, [
                'weekday' => ['required', 'integer', 'min:0', 'max:6'],
                'startTime' => ['required', 'string', 'max:5'],
                'endTime' => ['required', 'string', 'max:5'],
            ]);
            if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $item['startTime'])
                || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $item['endTime'])
                || $item['startTime'] >= $item['endTime']) {
                throw new ApiException(422, 'INVALID_TIME_RANGE', 'Uma faixa de disponibilidade é inválida.');
            }
            $normalized[] = $item;
        }
        usort($normalized, static fn (array $left, array $right): int => $left['weekday'] <=> $right['weekday'] ?: strcmp($left['startTime'], $right['startTime']));
        foreach ($normalized as $index => $item) {
            if ($index === 0) {
                continue;
            }
            $previous = $normalized[$index - 1];
            if ($previous['weekday'] === $item['weekday'] && $previous['endTime'] > $item['startTime']) {
                throw new ApiException(422, 'OVERLAPPING_AVAILABILITY', 'As faixas de disponibilidade do mesmo dia não podem se sobrepor.');
            }
        }

        $this->db->beginTransaction();
        try {
            $this->db->prepare('UPDATE availability_rules SET active = 0, updated_at = UTC_TIMESTAMP() WHERE professional_id = :id')
                ->execute(['id' => $auth['id']]);
            $insert = $this->db->prepare(
                'INSERT INTO availability_rules (public_id, professional_id, weekday, start_time, end_time, active, created_at, updated_at)
                 VALUES (:public_id, :professional_id, :weekday, :start_time, :end_time, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
            );
            foreach ($normalized as $item) {
                $insert->execute([
                    'public_id' => Uuid::v4(), 'professional_id' => $auth['id'], 'weekday' => $item['weekday'],
                    'start_time' => $item['startTime'] . ':00', 'end_time' => $item['endTime'] . ':00',
                ]);
            }
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
        return $this->availability($request, [], $auth);
    }

    public function availabilityExceptions(Request $request, array $params, ?array $auth): Response
    {
        $statement = $this->db->prepare(
            'SELECT public_id AS id, exception_date AS date, type,
                    TIME_FORMAT(start_time, \'%H:%i\') AS startTime,
                    TIME_FORMAT(end_time, \'%H:%i\') AS endTime, reason
             FROM availability_exceptions WHERE professional_id = :id AND exception_date >= CURRENT_DATE()
             ORDER BY exception_date, start_time'
        );
        $statement->execute(['id' => $auth['id']]);
        return Response::data($statement->fetchAll());
    }

    public function createAvailabilityException(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, [
            'date' => ['required', 'date'], 'type' => ['required', 'string', 'in:available,unavailable'],
            'startTime' => ['nullable', 'string', 'max:5'], 'endTime' => ['nullable', 'string', 'max:5'],
            'reason' => ['nullable', 'string', 'max:250'],
        ]);
        $today = new \DateTimeImmutable('today', new \DateTimeZone($this->config['timezone']));
        $exceptionDate = \DateTimeImmutable::createFromFormat('!Y-m-d', $data['date'], new \DateTimeZone($this->config['timezone']));
        if (!$exceptionDate || $exceptionDate < $today) {
            throw new ApiException(422, 'INVALID_DATE', 'A exceção precisa usar a data de hoje ou uma data futura.');
        }
        $start = $data['startTime'] ?? null;
        $end = $data['endTime'] ?? null;
        if (($start === null) !== ($end === null)
            || ($start !== null && (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $start)
                || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $end) || $start >= $end))) {
            throw new ApiException(422, 'INVALID_TIME_RANGE', 'Informe início e fim válidos ou deixe ambos vazios para bloquear o dia inteiro.');
        }
        $publicId = Uuid::v4();
        $this->db->prepare(
            'INSERT INTO availability_exceptions
                (public_id, professional_id, exception_date, type, start_time, end_time, reason, created_at)
             VALUES (:public_id, :professional_id, :date, :type, :start_time, :end_time, :reason, UTC_TIMESTAMP())'
        )->execute([
            'public_id' => $publicId, 'professional_id' => $auth['id'], 'date' => $data['date'], 'type' => $data['type'],
            'start_time' => $start ? $start . ':00' : null, 'end_time' => $end ? $end . ':00' : null, 'reason' => $data['reason'] ?? null,
        ]);
        return Response::data(['id' => $publicId, ...$data], 201);
    }

    public function deleteAvailabilityException(Request $request, array $params, ?array $auth): Response
    {
        $this->db->prepare('DELETE FROM availability_exceptions WHERE public_id = :id AND professional_id = :professional_id')
            ->execute(['id' => $params['id'], 'professional_id' => $auth['id']]);
        return Response::noContent();
    }

    public function jobs(Request $request, array $params, ?array $auth): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request, 20, 50);
        $status = (string) ($request->query['status'] ?? '');
        $where = 'b.professional_id = :id';
        $values = ['id' => $auth['id']];
        if ($status !== '') {
            $where .= ' AND b.status = :status';
            $values['status'] = $status;
        }
        $statement = $this->db->prepare(
            "SELECT b.public_id AS id, b.status,
                    DATE_FORMAT(b.scheduled_start, '%Y-%m-%dT%H:%i:%sZ') AS scheduledStart,
                    DATE_FORMAT(b.scheduled_end, '%Y-%m-%dT%H:%i:%sZ') AS scheduledEnd,
                    b.total_cents AS totalCents, b.professional_amount_cents AS professionalAmountCents,
                    s.name AS serviceName, u.name AS customerName,
                    JSON_UNQUOTE(JSON_EXTRACT(b.address_snapshot, '$.city')) AS city,
                    JSON_UNQUOTE(JSON_EXTRACT(b.address_snapshot, '$.state')) AS state,
                    cv.public_id AS conversationId
             FROM bookings b INNER JOIN services s ON s.id = b.service_id INNER JOIN users u ON u.id = b.customer_id
             LEFT JOIN conversations cv ON cv.booking_id = b.id WHERE {$where}
             ORDER BY (b.scheduled_start >= UTC_TIMESTAMP()) DESC,
                      CASE WHEN b.scheduled_start >= UTC_TIMESTAMP() THEN b.scheduled_start END ASC,
                      b.scheduled_start DESC LIMIT {$perPage} OFFSET {$offset}"
        );
        $statement->execute($values);
        return Response::data($statement->fetchAll(), 200, ['page' => $page, 'perPage' => $perPage]);
    }

    public function openRequests(Request $request, array $params, ?array $auth): Response
    {
        $this->assertApprovedProvider((int) $auth['id']);
        [$page, $perPage, $offset] = $this->pagination($request, 20, 50);
        $statement = $this->db->prepare(
            "SELECT DISTINCT b.public_id AS id,
                    DATE_FORMAT(b.scheduled_start, '%Y-%m-%dT%H:%i:%sZ') AS scheduledStart,
                    b.duration_minutes AS durationMinutes,
                    b.quantity, b.area_sqm AS areaSqm, b.subtotal_cents AS suggestedSubtotalCents,
                    s.name AS serviceName, a.city, a.state,
                    DATE_FORMAT(b.created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt
             FROM bookings b
             INNER JOIN services s ON s.id = b.service_id
             INNER JOIN professional_services ps ON ps.service_id = b.service_id AND ps.professional_id = :professional_id AND ps.active = 1
             LEFT JOIN addresses a ON a.id = b.address_id
             WHERE b.mode = 'marketplace' AND b.status = 'open' AND b.customer_id <> :current_user_id
             ORDER BY createdAt DESC LIMIT {$perPage} OFFSET {$offset}"
        );
        $statement->execute(['professional_id' => $auth['id'], 'current_user_id' => $auth['id']]);
        return Response::data($statement->fetchAll(), 200, ['page' => $page, 'perPage' => $perPage]);
    }

    public function createOffer(Request $request, array $params, ?array $auth): Response
    {
        $this->assertApprovedProvider((int) $auth['id']);
        $data = Validator::validate($request->body, [
            'amountCents' => ['required', 'integer', 'min:1000', 'max:10000000'],
            'message' => ['nullable', 'string', 'max:1000'],
        ]);
        $booking = $this->requireRow(
            'SELECT b.id, b.customer_id, b.service_id FROM bookings b
             INNER JOIN professional_services ps ON ps.service_id = b.service_id AND ps.professional_id = :professional_id AND ps.active = 1
             WHERE b.public_id = :booking AND b.mode = \'marketplace\' AND b.status = \'open\'',
            ['professional_id' => $auth['id'], 'booking' => $params['bookingId']],
            'Solicitação aberta não encontrada.'
        );
        if ((int) $booking['customer_id'] === (int) $auth['id']) {
            throw new ApiException(422, 'OWN_BOOKING', 'Você não pode enviar proposta para a própria solicitação.');
        }
        $publicId = Uuid::v4();
        try {
            $this->db->prepare(
                'INSERT INTO booking_offers
                    (public_id, booking_id, professional_id, amount_cents, message, status, expires_at, created_at, updated_at)
                 VALUES (:public_id, :booking_id, :professional_id, :amount, :message, \'pending\', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 48 HOUR), UTC_TIMESTAMP(), UTC_TIMESTAMP())'
            )->execute([
                'public_id' => $publicId, 'booking_id' => $booking['id'], 'professional_id' => $auth['id'],
                'amount' => $data['amountCents'], 'message' => $data['message'] ?? null,
            ]);
        } catch (\PDOException $exception) {
            if ($exception->getCode() === '23000') {
                throw new ApiException(409, 'OFFER_ALREADY_EXISTS', 'Você já enviou uma proposta para esta solicitação.');
            }
            throw $exception;
        }
        $this->notify((int) $booking['customer_id'], 'offer.received', 'Nova proposta', 'Um profissional enviou uma proposta para seu serviço.', ['bookingId' => $params['bookingId']]);
        return Response::data(['id' => $publicId, 'status' => 'pending'], 201);
    }

    public function withdrawOffer(Request $request, array $params, ?array $auth): Response
    {
        $statement = $this->db->prepare(
            'UPDATE booking_offers SET status = \'withdrawn\', updated_at = UTC_TIMESTAMP()
             WHERE public_id = :id AND professional_id = :professional_id AND status = \'pending\''
        );
        $statement->execute(['id' => $params['offerId'], 'professional_id' => $auth['id']]);
        if ($statement->rowCount() === 0) {
            throw new ApiException(404, 'OFFER_NOT_FOUND', 'Proposta pendente não encontrada.');
        }
        return Response::noContent();
    }

    private function assertApprovedProvider(int $professionalId): void
    {
        $statement = $this->db->prepare(
            'SELECT verification_status FROM professional_profiles WHERE user_id = :id LIMIT 1'
        );
        $statement->execute(['id' => $professionalId]);
        if ($statement->fetchColumn() !== 'approved') {
            throw new ApiException(403, 'PROVIDER_NOT_APPROVED', 'Seu cadastro profissional precisa estar aprovado para acessar oportunidades.');
        }
    }
}
