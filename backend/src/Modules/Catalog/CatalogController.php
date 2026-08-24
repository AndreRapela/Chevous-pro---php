<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Catalog;

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Controller;
use ChezVoust\Core\Request;
use ChezVoust\Core\Response;
use DateTimeImmutable;
use DateTimeZone;

final class CatalogController extends Controller
{
    public function appConfig(Request $request, array $params, ?array $auth): Response
    {
        $settings = $this->db->query('SELECT setting_key, setting_value FROM app_settings WHERE is_public = 1')->fetchAll();
        $values = [];
        foreach ($settings as $setting) {
            $decoded = json_decode($setting['setting_value'], true);
            $values[$setting['setting_key']] = json_last_error() === JSON_ERROR_NONE ? $decoded : $setting['setting_value'];
        }
        return Response::data([
            'brand' => $this->config['name'],
            'locale' => $this->config['locale'],
            'currency' => $this->config['currency'],
            'timezone' => $this->config['timezone'],
            'settings' => $values,
        ]);
    }

    public function home(Request $request, array $params, ?array $auth): Response
    {
        $categories = $this->db->query(
            'SELECT public_id AS id, name, slug, description, icon, color
             FROM service_categories WHERE active = 1 ORDER BY sort_order, name LIMIT 12'
        )->fetchAll();
        $promotions = $this->db->query(
            'SELECT public_id AS id, title, subtitle, cta_label AS ctaLabel, cta_url AS ctaUrl,
                    background_color AS backgroundColor, text_color AS textColor
             FROM promotions WHERE active = 1
               AND (starts_at IS NULL OR starts_at <= UTC_TIMESTAMP())
               AND (ends_at IS NULL OR ends_at >= UTC_TIMESTAMP())
             ORDER BY sort_order, created_at DESC LIMIT 8'
        )->fetchAll();
        $professionals = $this->db->query(
            'SELECT u.public_id AS id, u.name, p.headline, p.base_city AS city, p.base_state AS state,
                    p.rating_avg AS rating, p.reviews_count AS reviewsCount, p.verification_status AS verificationStatus
             FROM professional_profiles p INNER JOIN users u ON u.id = p.user_id
             WHERE u.status = \'active\' AND p.verification_status = \'approved\'
             ORDER BY p.featured DESC, p.rating_avg DESC, p.completed_jobs DESC LIMIT 8'
        )->fetchAll();
        return Response::data(compact('promotions', 'categories', 'professionals'));
    }

    public function categories(Request $request, array $params, ?array $auth): Response
    {
        $rows = $this->db->query(
            'SELECT c.public_id AS id, c.name, c.slug, c.description, c.icon, c.color,
                    COUNT(s.id) AS servicesCount
             FROM service_categories c LEFT JOIN services s ON s.category_id = c.id AND s.active = 1
             WHERE c.active = 1 GROUP BY c.id ORDER BY c.sort_order, c.name'
        )->fetchAll();
        return Response::data($rows);
    }

    public function services(Request $request, array $params, ?array $auth): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request, 20, 50);
        $where = ['s.active = 1', 'c.active = 1'];
        $values = [];
        if (!empty($request->query['category'])) {
            $where[] = '(c.public_id = :category_id OR c.slug = :category_slug)';
            $values['category_id'] = (string) $request->query['category'];
            $values['category_slug'] = (string) $request->query['category'];
        }
        if (!empty($request->query['q'])) {
            $where[] = '(s.name LIKE :search_name OR s.description LIKE :search_description)';
            $search = '%' . mb_substr((string) $request->query['q'], 0, 80) . '%';
            $values['search_name'] = $search;
            $values['search_description'] = $search;
        }

        $whereSql = implode(' AND ', $where);
        $count = $this->db->prepare("SELECT COUNT(*) FROM services s INNER JOIN service_categories c ON c.id = s.category_id WHERE {$whereSql}");
        $count->execute($values);
        $total = (int) $count->fetchColumn();

        $statement = $this->db->prepare(
            "SELECT s.public_id AS id, s.name, s.slug, s.short_description AS shortDescription,
                    s.pricing_type AS pricingType, s.price_cents AS priceCents, s.unit_label AS unitLabel,
                    s.default_duration_minutes AS defaultDurationMinutes,
                    c.public_id AS categoryId, c.name AS categoryName, c.slug AS categorySlug
             FROM services s INNER JOIN service_categories c ON c.id = s.category_id
             WHERE {$whereSql} ORDER BY s.featured DESC, s.sort_order, s.name LIMIT {$perPage} OFFSET {$offset}"
        );
        $statement->execute($values);
        return Response::data($statement->fetchAll(), 200, [
            'page' => $page, 'perPage' => $perPage, 'total' => $total, 'lastPage' => max(1, (int) ceil($total / $perPage)),
        ]);
    }

    public function service(Request $request, array $params, ?array $auth): Response
    {
        $service = $this->requireRow(
            'SELECT s.id AS internalId, s.public_id AS id, s.name, s.slug, s.description,
                    s.short_description AS shortDescription, s.pricing_type AS pricingType,
                    s.price_cents AS priceCents, s.unit_label AS unitLabel,
                    s.default_duration_minutes AS defaultDurationMinutes,
                    s.minimum_quantity AS minimumQuantity, s.maximum_quantity AS maximumQuantity,
                    c.public_id AS categoryId, c.name AS categoryName
             FROM services s INNER JOIN service_categories c ON c.id = s.category_id
             WHERE (s.public_id = :public_id OR s.slug = :slug) AND s.active = 1 AND c.active = 1',
            ['public_id' => $params['id'], 'slug' => $params['id']],
            'Serviço não encontrado.'
        );
        $addons = $this->db->prepare(
            'SELECT public_id AS id, name, description, price_cents AS priceCents, pricing_type AS pricingType
             FROM service_addons WHERE service_id = :service_id AND active = 1 ORDER BY sort_order, name'
        );
        $addons->execute(['service_id' => $service['internalId']]);
        unset($service['internalId']);
        $service['addons'] = $addons->fetchAll();
        return Response::data($service);
    }

    public function professionals(Request $request, array $params, ?array $auth): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request, 16, 50);
        $joins = [];
        $where = ['u.status = \'active\'', 'p.verification_status = \'approved\''];
        $values = [];

        if (!empty($request->query['service'])) {
            $joins[] = 'INNER JOIN professional_services ps ON ps.professional_id = u.id AND ps.active = 1';
            $joins[] = 'INNER JOIN services s ON s.id = ps.service_id';
            $where[] = '(s.public_id = :service_id OR s.slug = :service_slug)';
            $values['service_id'] = (string) $request->query['service'];
            $values['service_slug'] = (string) $request->query['service'];
        }
        if (!empty($request->query['city'])) {
            $where[] = 'p.base_city LIKE :city';
            $values['city'] = '%' . mb_substr((string) $request->query['city'], 0, 100) . '%';
        }
        if (!empty($request->query['state'])) {
            $where[] = 'p.base_state = :state';
            $values['state'] = strtoupper(mb_substr((string) $request->query['state'], 0, 2));
        }
        if (isset($request->query['ratingMin']) && is_numeric($request->query['ratingMin'])) {
            $where[] = 'p.rating_avg >= :rating';
            $values['rating'] = max(0, min(5, (float) $request->query['ratingMin']));
        }

        $joinSql = implode(' ', $joins);
        $whereSql = implode(' AND ', $where);
        $sort = match ($request->query['sort'] ?? '') {
            'rating' => 'p.rating_avg DESC, p.reviews_count DESC',
            'experience' => 'p.years_experience DESC, p.completed_jobs DESC',
            default => 'p.featured DESC, p.rating_avg DESC, p.completed_jobs DESC',
        };

        $count = $this->db->prepare("SELECT COUNT(DISTINCT u.id) FROM users u INNER JOIN professional_profiles p ON p.user_id = u.id {$joinSql} WHERE {$whereSql}");
        $count->execute($values);
        $total = (int) $count->fetchColumn();
        $statement = $this->db->prepare(
            "SELECT u.public_id AS id, u.name, p.headline, p.bio, p.base_city AS city,
                    p.base_state AS state, p.years_experience AS yearsExperience, p.rating_avg AS rating,
                    p.reviews_count AS reviewsCount, p.completed_jobs AS completedJobs,
                    p.verification_status AS verificationStatus,
                    (SELECT GROUP_CONCAT(s2.public_id ORDER BY s2.public_id)
                     FROM professional_services ps2 INNER JOIN services s2 ON s2.id = ps2.service_id
                     WHERE ps2.professional_id = u.id AND ps2.active = 1 AND s2.active = 1) AS serviceIds,
                    (SELECT MIN(COALESCE(ps3.price_cents, s3.price_cents))
                     FROM professional_services ps3 INNER JOIN services s3 ON s3.id = ps3.service_id
                     WHERE ps3.professional_id = u.id AND ps3.active = 1 AND s3.active = 1) AS priceFromCents
             FROM users u INNER JOIN professional_profiles p ON p.user_id = u.id {$joinSql}
             WHERE {$whereSql} ORDER BY {$sort} LIMIT {$perPage} OFFSET {$offset}"
        );
        $statement->execute($values);
        $rows = $statement->fetchAll();
        foreach ($rows as &$row) {
            $row['serviceIds'] = $row['serviceIds'] ? explode(',', (string) $row['serviceIds']) : [];
        }
        unset($row);
        return Response::data($rows, 200, [
            'page' => $page, 'perPage' => $perPage, 'total' => $total, 'lastPage' => max(1, (int) ceil($total / $perPage)),
        ]);
    }

    public function professional(Request $request, array $params, ?array $auth): Response
    {
        $professional = $this->requireRow(
            'SELECT u.id AS internalId, u.public_id AS id, u.name, p.headline, p.bio,
                    p.base_city AS city, p.base_state AS state, p.years_experience AS yearsExperience,
                    p.service_radius_km AS serviceRadiusKm, p.rating_avg AS rating,
                    p.reviews_count AS reviewsCount, p.completed_jobs AS completedJobs,
                    p.verification_status AS verificationStatus, p.created_at AS memberSince
             FROM users u INNER JOIN professional_profiles p ON p.user_id = u.id
             WHERE u.public_id = :id AND u.status = \'active\' AND p.verification_status = \'approved\'',
            ['id' => $params['id']],
            'Profissional não encontrado.'
        );
        $services = $this->db->prepare(
            'SELECT s.public_id AS id, s.name, s.slug, COALESCE(ps.price_cents, s.price_cents) AS priceCents,
                    s.pricing_type AS pricingType, s.unit_label AS unitLabel
             FROM professional_services ps INNER JOIN services s ON s.id = ps.service_id
             WHERE ps.professional_id = :professional_id AND ps.active = 1 AND s.active = 1 ORDER BY s.name'
        );
        $services->execute(['professional_id' => $professional['internalId']]);
        $professional['services'] = $services->fetchAll();
        unset($professional['internalId']);
        return Response::data($professional);
    }

    public function availability(Request $request, array $params, ?array $auth): Response
    {
        $professional = $this->requireRow(
            'SELECT u.id FROM users u INNER JOIN professional_profiles p ON p.user_id = u.id
             WHERE u.public_id = :id AND u.status = \'active\' AND p.verification_status = \'approved\'',
            ['id' => $params['id']],
            'Profissional não encontrado.'
        );
        $rules = $this->db->prepare(
            'SELECT public_id AS id, weekday, TIME_FORMAT(start_time, \'%H:%i\') AS startTime,
                    TIME_FORMAT(end_time, \'%H:%i\') AS endTime
             FROM availability_rules WHERE professional_id = :id AND active = 1 ORDER BY weekday, start_time'
        );
        $rules->execute(['id' => $professional['id']]);
        $ruleRows = $rules->fetchAll();
        $exceptions = $this->db->prepare(
            'SELECT public_id AS id, exception_date AS date, type,
                    TIME_FORMAT(start_time, \'%H:%i\') AS startTime,
                    TIME_FORMAT(end_time, \'%H:%i\') AS endTime, reason
             FROM availability_exceptions WHERE professional_id = :id AND exception_date >= CURRENT_DATE()
             ORDER BY exception_date, start_time LIMIT 90'
        );
        $exceptions->execute(['id' => $professional['id']]);
        $exceptionRows = $exceptions->fetchAll();

        $slots = [];
        $dateValue = trim((string) ($request->query['date'] ?? ''));
        if ($dateValue !== '') {
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateValue)) {
                throw new ApiException(422, 'INVALID_DATE', 'Data de disponibilidade inválida.');
            }
            $duration = (int) ($request->query['durationMinutes'] ?? 120);
            if ($duration < 30 || $duration > 1440 || $duration % 30 !== 0) {
                throw new ApiException(422, 'INVALID_DURATION', 'A duração deve usar intervalos de 30 minutos.');
            }
            $timezone = new DateTimeZone($this->config['timezone']);
            $day = DateTimeImmutable::createFromFormat('!Y-m-d', $dateValue, $timezone);
            $dateErrors = DateTimeImmutable::getLastErrors();
            if (!$day || ($dateErrors !== false && ($dateErrors['warning_count'] > 0 || $dateErrors['error_count'] > 0))) {
                throw new ApiException(422, 'INVALID_DATE', 'Data de disponibilidade inválida.');
            }
            if ($day < new DateTimeImmutable('today', $timezone)) {
                throw new ApiException(422, 'INVALID_DATE', 'Consulte uma data de hoje ou futura.');
            }
            $dayEnd = $day->modify('+1 day');
            $busyStatement = $this->db->prepare(
                "SELECT scheduled_start, scheduled_end FROM bookings
                 WHERE professional_id = :booking_professional_id
                   AND status IN ('awaiting_payment', 'confirmed', 'provider_on_the_way', 'in_progress')
                   AND scheduled_start < :booking_day_end AND scheduled_end > :booking_day_start
                 UNION ALL
                 SELECT starts_at AS scheduled_start, ends_at AS scheduled_end FROM slot_reservations
                 WHERE professional_id = :slot_professional_id AND status = 'held' AND expires_at > UTC_TIMESTAMP()
                   AND starts_at < :slot_day_end AND ends_at > :slot_day_start"
            );
            $busyStatement->execute([
                'booking_professional_id' => $professional['id'], 'slot_professional_id' => $professional['id'],
                'booking_day_start' => $day->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
                'booking_day_end' => $dayEnd->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
                'slot_day_start' => $day->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
                'slot_day_end' => $dayEnd->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
            ]);
            $busyRows = $busyStatement->fetchAll();
            $intervals = [];
            foreach ($ruleRows as $rule) {
                if ((int) $rule['weekday'] !== (int) $day->format('w')) {
                    continue;
                }
                $intervals[] = ['startTime' => $rule['startTime'], 'endTime' => $rule['endTime']];
            }
            foreach ($exceptionRows as $exception) {
                if ($exception['date'] === $dateValue && $exception['type'] === 'available' && $exception['startTime'] !== null && $exception['endTime'] !== null) {
                    $intervals[] = ['startTime' => $exception['startTime'], 'endTime' => $exception['endTime']];
                }
            }
            foreach ($intervals as $interval) {
                $cursor = new DateTimeImmutable($dateValue . ' ' . $interval['startTime'], $timezone);
                $intervalEnd = new DateTimeImmutable($dateValue . ' ' . $interval['endTime'], $timezone);
                while ($cursor->modify('+' . $duration . ' minutes') <= $intervalEnd) {
                    $candidateEnd = $cursor->modify('+' . $duration . ' minutes');
                    $blocked = $cursor->getTimestamp() < time() + 1800;
                    foreach ($exceptionRows as $exception) {
                        if ($blocked || $exception['date'] !== $dateValue || $exception['type'] !== 'unavailable') {
                            continue;
                        }
                        if ($exception['startTime'] === null || $exception['endTime'] === null) {
                            $blocked = true;
                            break;
                        }
                        $exceptionStart = new DateTimeImmutable($dateValue . ' ' . $exception['startTime'], $timezone);
                        $exceptionEnd = new DateTimeImmutable($dateValue . ' ' . $exception['endTime'], $timezone);
                        if ($cursor < $exceptionEnd && $candidateEnd > $exceptionStart) {
                            $blocked = true;
                            break;
                        }
                    }
                    $candidateStartUtc = $cursor->setTimezone(new DateTimeZone('UTC'))->getTimestamp();
                    $candidateEndUtc = $candidateEnd->setTimezone(new DateTimeZone('UTC'))->getTimestamp();
                    foreach ($busyRows as $busy) {
                        if ($blocked) {
                            break;
                        }
                        $busyStart = strtotime((string) $busy['scheduled_start'] . ' UTC');
                        $busyEnd = strtotime((string) $busy['scheduled_end'] . ' UTC');
                        if ($candidateStartUtc < $busyEnd && $candidateEndUtc > $busyStart) {
                            $blocked = true;
                        }
                    }
                    if (!$blocked) {
                        $slots[] = $cursor->format('H:i');
                    }
                    $cursor = $cursor->modify('+30 minutes');
                }
            }
            $slots = array_values(array_unique($slots));
            sort($slots);
        }
        return Response::data(['rules' => $ruleRows, 'exceptions' => $exceptionRows, 'slots' => $slots]);
    }
}
