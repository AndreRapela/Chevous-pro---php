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
    public function robots(Request $request, array $params, ?array $auth): Response
    {
        $siteUrl = rtrim((string) $this->config['url'], '/');
        $body = "User-agent: *\n"
            . "Allow: /\n"
            . "Disallow: /api/\n"
            . "Disallow: /entrar\n"
            . "Disallow: /cadastro\n"
            . "Disallow: /recuperar-senha\n"
            . "Disallow: /redefinir-senha\n"
            . "Disallow: /verificar-email\n"
            . "Disallow: /agendar/\n"
            . "Disallow: /conta/\n"
            . "Disallow: /prestador/\n"
            . "Disallow: /admin/\n"
            . "\nSitemap: {$siteUrl}/sitemap.xml\n";
        return Response::text($body, 'text/plain; charset=utf-8', 3600);
    }

    public function sitemap(Request $request, array $params, ?array $auth): Response
    {
        $baseUrl = rtrim((string) $this->config['url'], '/');
        $entries = [
            ['/', 'weekly', '1.0', null],
            ['/servicos', 'daily', '0.9', null],
            ['/produtos', 'daily', '0.8', null],
            ['/profissionais', 'daily', '0.9', null],
            ['/como-funciona', 'monthly', '0.6', null],
            ['/seguranca', 'monthly', '0.6', null],
            ['/ajuda', 'monthly', '0.5', null],
            ['/termos', 'yearly', '0.3', null],
            ['/privacidade', 'yearly', '0.3', null],
        ];
        $categories = $this->db->query(
            'SELECT slug, DATE_FORMAT(updated_at, \'%Y-%m-%d\') AS lastmod
             FROM service_categories WHERE active = 1 ORDER BY sort_order, name'
        )->fetchAll();
        foreach ($categories as $category) {
            $entries[] = ['/servicos/categoria/' . rawurlencode((string) $category['slug']), 'weekly', '0.7', $category['lastmod']];
        }
        $services = $this->db->query(
            'SELECT slug, DATE_FORMAT(updated_at, \'%Y-%m-%d\') AS lastmod
             FROM services WHERE active = 1 ORDER BY updated_at DESC'
        )->fetchAll();
        foreach ($services as $service) {
            $entries[] = ['/servicos/' . rawurlencode((string) $service['slug']), 'weekly', '0.8', $service['lastmod']];
        }
        $professionals = $this->db->query(
            'SELECT u.public_id AS id, u.name, p.base_city AS city,
                    DATE_FORMAT(GREATEST(u.updated_at, p.updated_at), \'%Y-%m-%d\') AS lastmod
             FROM users u INNER JOIN professional_profiles p ON p.user_id = u.id
             WHERE u.status = \'active\' AND p.verification_status = \'approved\'
             ORDER BY p.updated_at DESC'
        )->fetchAll();
        foreach ($professionals as $professional) {
            $slug = $this->publicSlug((string) $professional['name'] . ' ' . (string) $professional['city']);
            $entries[] = ['/profissionais/' . rawurlencode((string) $professional['id']) . '/' . rawurlencode($slug), 'weekly', '0.8', $professional['lastmod']];
        }

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        foreach ($entries as [$path, $changeFrequency, $priority, $lastModified]) {
            $xml .= "  <url><loc>" . $this->xml($baseUrl . $path) . "</loc>";
            if (is_string($lastModified) && $lastModified !== '') {
                $xml .= '<lastmod>' . $this->xml($lastModified) . '</lastmod>';
            }
            $xml .= '<changefreq>' . $changeFrequency . '</changefreq><priority>' . $priority . "</priority></url>\n";
        }
        $xml .= '</urlset>\n';
        return Response::text($xml, 'application/xml; charset=utf-8', 3600);
    }

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
                    image_url AS imageUrl, badge_text AS badgeText, terms_text AS termsText,
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

    public function products(Request $request, array $params, ?array $auth): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request, 24, 50);
        $where = ['active = 1'];
        $values = [];
        if (!empty($request->query['q'])) {
            $where[] = '(name LIKE :name_query OR short_description LIKE :description_query)';
            $search = '%' . mb_substr((string) $request->query['q'], 0, 100) . '%';
            $values['name_query'] = $search;
            $values['description_query'] = $search;
        }
        $whereSql = implode(' AND ', $where);
        $count = $this->db->prepare("SELECT COUNT(*) FROM products WHERE {$whereSql}");
        $count->execute($values);
        $total = (int) $count->fetchColumn();
        $statement = $this->db->prepare(
            "SELECT public_id AS id, name, slug, short_description AS shortDescription,
                    price_cents AS priceCents, compare_at_price_cents AS compareAtPriceCents, currency,
                    image_url AS imageUrl, purchase_url AS purchaseUrl, badge_text AS badgeText,
                    inventory_count AS inventoryCount, featured
             FROM products WHERE {$whereSql}
             ORDER BY featured DESC, sort_order, created_at DESC LIMIT {$perPage} OFFSET {$offset}"
        );
        $statement->execute($values);
        return Response::data($statement->fetchAll(), 200, [
            'page' => $page, 'perPage' => $perPage, 'total' => $total, 'lastPage' => max(1, (int) ceil($total / $perPage)),
        ]);
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
            $where[] = '(s.name LIKE :search_name OR s.short_description LIKE :search_short_description OR s.description LIKE :search_description)';
            $search = '%' . mb_substr((string) $request->query['q'], 0, 80) . '%';
            $values['search_name'] = $search;
            $values['search_short_description'] = $search;
            $values['search_description'] = $search;
        }
        if (!empty($request->query['professional'])) {
            $where[] = 'EXISTS (SELECT 1 FROM professional_services ps INNER JOIN users pu ON pu.id = ps.professional_id WHERE ps.service_id = s.id AND ps.active = 1 AND pu.public_id = :professional_id AND pu.status = \'active\')';
            $values['professional_id'] = (string) $request->query['professional'];
        }

        $whereSql = implode(' AND ', $where);
        $count = $this->db->prepare("SELECT COUNT(*) FROM services s INNER JOIN service_categories c ON c.id = s.category_id WHERE {$whereSql}");
        $count->execute($values);
        $total = (int) $count->fetchColumn();

        $statement = $this->db->prepare(
            "SELECT s.public_id AS id, s.name, s.slug, s.short_description AS shortDescription,
                    s.pricing_type AS pricingType, s.price_cents AS priceCents, s.unit_label AS unitLabel,
                    s.default_duration_minutes AS defaultDurationMinutes,
                    c.public_id AS categoryId, c.name AS categoryName, c.slug AS categorySlug,
                    (c.slug = 'outros') AS isCustom
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
                    c.public_id AS categoryId, c.name AS categoryName, (c.slug = \'outros\') AS isCustom
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
            'price' => 'COALESCE((SELECT MIN(COALESCE(ps4.price_cents, s4.price_cents)) FROM professional_services ps4 INNER JOIN services s4 ON s4.id = ps4.service_id WHERE ps4.professional_id = u.id AND ps4.active = 1 AND s4.active = 1), 2147483647) ASC, p.rating_avg DESC',
            default => 'p.featured DESC, p.rating_avg DESC, p.completed_jobs DESC',
        };

        $count = $this->db->prepare("SELECT COUNT(DISTINCT u.id) FROM users u INNER JOIN professional_profiles p ON p.user_id = u.id {$joinSql} WHERE {$whereSql}");
        $count->execute($values);
        $total = (int) $count->fetchColumn();
        $statement = $this->db->prepare(
            "SELECT u.public_id AS id, u.name, u.avatar_path AS avatarPath, u.avatar_updated_at AS avatarUpdatedAt, p.headline, p.bio, p.base_city AS city,
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
            $row['avatarUrl'] = $this->avatarUrl((string) $row['id'], $row['avatarPath'] ?? null, $row['avatarUpdatedAt'] ?? null);
            unset($row['avatarPath'], $row['avatarUpdatedAt']);
        }
        unset($row);
        return Response::data($rows, 200, [
            'page' => $page, 'perPage' => $perPage, 'total' => $total, 'lastPage' => max(1, (int) ceil($total / $perPage)),
        ]);
    }

    public function professional(Request $request, array $params, ?array $auth): Response
    {
        $professional = $this->requireRow(
            'SELECT u.id AS internalId, u.public_id AS id, u.name, u.avatar_path AS avatarPath, u.avatar_updated_at AS avatarUpdatedAt, p.headline, p.bio,
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
        $experiences = $this->db->prepare(
            'SELECT public_id AS id, role_title AS role, company_name AS company, description,
                    DATE_FORMAT(started_at, \'%Y-%m-%d\') AS startedAt, DATE_FORMAT(ended_at, \'%Y-%m-%d\') AS endedAt,
                    is_current AS current
             FROM professional_experiences WHERE professional_id = :professional_id ORDER BY is_current DESC, started_at DESC'
        );
        $experiences->execute(['professional_id' => $professional['internalId']]);
        $professional['experiences'] = $experiences->fetchAll();
        $courses = $this->db->prepare(
            'SELECT public_id AS id, title, institution, DATE_FORMAT(completed_at, \'%Y-%m-%d\') AS completedAt,
                    certificate_url AS certificateUrl
             FROM professional_courses WHERE professional_id = :professional_id ORDER BY completed_at DESC, created_at DESC'
        );
        $courses->execute(['professional_id' => $professional['internalId']]);
        $professional['courses'] = $courses->fetchAll();
        $professional['avatarUrl'] = $this->avatarUrl((string) $professional['id'], $professional['avatarPath'] ?? null, $professional['avatarUpdatedAt'] ?? null);
        unset($professional['avatarPath'], $professional['avatarUpdatedAt']);
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
                   AND status IN ('confirmed', 'provider_on_the_way', 'in_progress')
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

    private function avatarUrl(string $publicId, mixed $path, mixed $updatedAt): ?string
    {
        if (!is_string($path) || $path === '') {
            return null;
        }
        return '/api/v1/avatars/' . rawurlencode($publicId) . '?v=' . urlencode((string) ($updatedAt ?? '0'));
    }

    private function publicSlug(string $value): string
    {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        $normalized = strtolower($ascii === false ? $value : $ascii);
        $slug = preg_replace('/[^a-z0-9]+/', '-', $normalized) ?? '';
        return trim($slug, '-') ?: 'profissional';
    }

    private function xml(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}
