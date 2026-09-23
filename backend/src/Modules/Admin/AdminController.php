<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Admin;

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Audit;
use ChezVoust\Core\Controller;
use ChezVoust\Core\Request;
use ChezVoust\Core\Response;
use ChezVoust\Core\Uuid;
use ChezVoust\Core\Validator;
use PDO;

final class AdminController extends Controller
{
    public function __construct(PDO $db, array $config, private readonly Audit $audit)
    {
        parent::__construct($db, $config);
    }

    public function dashboard(Request $request, array $params, ?array $auth): Response
    {
        $metricsStatement = $this->db->prepare(
            'SELECT
                (SELECT COUNT(*) FROM users WHERE role = \'customer\' AND deleted_at IS NULL) AS customers,
                (SELECT COUNT(*) FROM users WHERE role = \'provider\' AND deleted_at IS NULL) AS professionals,
                (SELECT COUNT(*) FROM professional_profiles WHERE verification_status = \'pending\') AS professionalsPending,
                (SELECT COUNT(*) FROM bookings) AS bookings,
                (SELECT COUNT(*) FROM bookings WHERE status = \'confirmed\') AS confirmedBookings,
                (SELECT COUNT(*) FROM bookings WHERE status = \'completed\') AS completedBookings'
        );
        $metricsStatement->execute();
        $metrics = $metricsStatement->fetch();
        $recent = $this->db->query(
            'SELECT b.public_id AS id, b.status,
                    DATE_FORMAT(b.created_at, \'%Y-%m-%dT%H:%i:%sZ\') AS createdAt,
                    c.name AS customerName, p.name AS professionalName, s.name AS serviceName
             FROM bookings b INNER JOIN users c ON c.id = b.customer_id
             LEFT JOIN users p ON p.id = b.professional_id INNER JOIN services s ON s.id = b.service_id
             ORDER BY b.created_at DESC LIMIT 10'
        )->fetchAll();
        return Response::data(['metrics' => $metrics, 'recentBookings' => $recent]);
    }

    public function users(Request $request, array $params, ?array $auth): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request, 30, 100);
        $where = ['deleted_at IS NULL'];
        $values = [];
        if (!empty($request->query['role'])) {
            $where[] = 'role = :role';
            $values['role'] = (string) $request->query['role'];
        }
        if (!empty($request->query['status'])) {
            $where[] = 'status = :status';
            $values['status'] = (string) $request->query['status'];
        }
        if (!empty($request->query['q'])) {
            $where[] = '(name LIKE :q_name OR email LIKE :q_email)';
            $search = '%' . mb_substr((string) $request->query['q'], 0, 100) . '%';
            $values['q_name'] = $search;
            $values['q_email'] = $search;
        }
        $whereSql = implode(' AND ', $where);
        $count = $this->db->prepare("SELECT COUNT(*) FROM users WHERE {$whereSql}");
        $count->execute($values);
        $total = (int) $count->fetchColumn();
        $statement = $this->db->prepare(
            "SELECT public_id AS id, role, name, email, phone, status, email_verified_at AS emailVerifiedAt,
                    last_login_at AS lastLoginAt, created_at AS createdAt
             FROM users WHERE {$whereSql} ORDER BY created_at DESC LIMIT {$perPage} OFFSET {$offset}"
        );
        $statement->execute($values);
        return Response::data($statement->fetchAll(), 200, [
            'page' => $page, 'perPage' => $perPage, 'total' => $total, 'lastPage' => max(1, (int) ceil($total / $perPage)),
        ]);
    }

    public function setUserStatus(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, [
            'status' => ['required', 'string', 'in:active,suspended'], 'reason' => ['nullable', 'string', 'max:500'],
        ]);
        $user = $this->requireRow('SELECT id, public_id, role FROM users WHERE public_id = :id AND deleted_at IS NULL', ['id' => $params['id']], 'Usuário não encontrado.');
        if ((int) $user['id'] === (int) $auth['id']) {
            throw new ApiException(422, 'SELF_STATUS_CHANGE', 'Você não pode suspender sua própria conta administrativa.');
        }
        $this->db->beginTransaction();
        try {
            $this->db->prepare('UPDATE users SET status = :status, updated_at = UTC_TIMESTAMP() WHERE id = :id')
                ->execute(['status' => $data['status'], 'id' => $user['id']]);
            if ($data['status'] === 'suspended') {
                $this->db->prepare('UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = :id AND revoked_at IS NULL')
                    ->execute(['id' => $user['id']]);
            }
            $this->notify(
                (int) $user['id'],
                'account.status',
                $data['status'] === 'active' ? 'Conta reativada' : 'Situação da conta atualizada',
                $data['status'] === 'active' ? 'Sua conta foi reativada pela equipe de suporte.' : 'Sua conta foi suspensa pela equipe de suporte.'
            );
            $this->audit->record((int) $auth['id'], 'admin.user_status', 'user', $user['public_id'], $request, $data);
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
        return Response::data(['id' => $user['public_id'], 'status' => $data['status']]);
    }

    public function pendingProfessionals(Request $request, array $params, ?array $auth): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request, 30, 100);
        $total = (int) $this->db->query(
            'SELECT COUNT(*) FROM professional_profiles p INNER JOIN users u ON u.id = p.user_id
             WHERE p.verification_status = \'pending\' AND u.status = \'active\''
        )->fetchColumn();
        $rows = $this->db->query(
            'SELECT u.public_id AS id, u.name, u.email, u.phone, p.headline, p.bio,
                    p.base_city AS city, p.base_state AS state, p.years_experience AS yearsExperience,
                    p.verification_status AS verificationStatus, p.created_at AS createdAt
             FROM professional_profiles p INNER JOIN users u ON u.id = p.user_id
             WHERE p.verification_status = \'pending\' AND u.status = \'active\'
             ORDER BY p.created_at LIMIT ' . $perPage . ' OFFSET ' . $offset
        )->fetchAll();
        return Response::data($rows, 200, [
            'page' => $page, 'perPage' => $perPage, 'total' => $total, 'lastPage' => max(1, (int) ceil($total / $perPage)),
        ]);
    }

    public function reviewProfessional(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, [
            'status' => ['required', 'string', 'in:approved,rejected,suspended'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'featured' => ['sometimes', 'boolean'],
        ]);
        $professional = $this->requireRow(
            'SELECT u.id, u.public_id FROM users u INNER JOIN professional_profiles p ON p.user_id = u.id WHERE u.public_id = :id',
            ['id' => $params['id']],
            'Profissional não encontrado.'
        );
        $sets = [
            'verification_status = :status', 'verification_notes = :notes',
            'verified_at = IF(:status_2 = \'approved\', UTC_TIMESTAMP(), NULL)', 'updated_at = UTC_TIMESTAMP()',
        ];
        $values = ['status' => $data['status'], 'status_2' => $data['status'], 'notes' => $data['notes'] ?? null, 'id' => $professional['id']];
        if (array_key_exists('featured', $data)) {
            $sets[] = 'featured = :featured';
            $values['featured'] = (int) (bool) $data['featured'];
        }
        $this->db->prepare('UPDATE professional_profiles SET ' . implode(', ', $sets) . ' WHERE user_id = :id')->execute($values);
        $this->notify((int) $professional['id'], 'professional.reviewed', 'Cadastro profissional analisado', 'Seu cadastro profissional foi atualizado para: ' . $data['status'] . '.', []);
        $this->audit->record((int) $auth['id'], 'admin.professional_review', 'professional', $professional['public_id'], $request, $data);
        return Response::data(['id' => $professional['public_id'], 'verificationStatus' => $data['status']]);
    }

    public function createCategory(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, [
            'name' => ['required', 'string', 'min:2', 'max:100'], 'slug' => ['nullable', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:1000'], 'icon' => ['nullable', 'string', 'max:60'],
            'color' => ['nullable', 'string', 'max:20'], 'sortOrder' => ['nullable', 'integer', 'min:0', 'max:999'],
        ]);
        $publicId = Uuid::v4();
        $slug = $data['slug'] ?? $this->slug((string) $data['name']);
        $this->db->prepare(
            'INSERT INTO service_categories (public_id, name, slug, description, icon, color, active, sort_order, created_at, updated_at)
             VALUES (:public_id, :name, :slug, :description, :icon, :color, 1, :sort_order, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        )->execute([
            'public_id' => $publicId, 'name' => $data['name'], 'slug' => $slug, 'description' => $data['description'] ?? null,
            'icon' => $data['icon'] ?? null, 'color' => $data['color'] ?? null, 'sort_order' => $data['sortOrder'] ?? 0,
        ]);
        return Response::data(['id' => $publicId, 'name' => $data['name'], 'slug' => $slug], 201);
    }

    public function updateCategory(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, [
            'name' => ['sometimes', 'string', 'min:2', 'max:100'], 'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'icon' => ['sometimes', 'nullable', 'string', 'max:60'], 'color' => ['sometimes', 'nullable', 'string', 'max:20'],
            'active' => ['sometimes', 'boolean'], 'sortOrder' => ['sometimes', 'integer', 'min:0', 'max:999'],
        ]);
        $map = ['name' => 'name', 'description' => 'description', 'icon' => 'icon', 'color' => 'color', 'active' => 'active', 'sortOrder' => 'sort_order'];
        $this->dynamicUpdate('service_categories', $params['id'], $data, $map);
        return Response::data(['id' => $params['id']] + $data);
    }

    public function createService(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, [
            'categoryId' => ['required', 'uuid'], 'name' => ['required', 'string', 'min:2', 'max:120'],
            'slug' => ['nullable', 'string', 'max:140'], 'shortDescription' => ['nullable', 'string', 'max:250'],
            'description' => ['nullable', 'string', 'max:4000'], 'pricingType' => ['required', 'string', 'in:fixed,hourly,area'],
            'priceCents' => ['required', 'integer', 'min:100', 'max:10000000'],
            'unitLabel' => ['nullable', 'string', 'max:30'], 'defaultDurationMinutes' => ['required', 'integer', 'min:30', 'max:1440'],
        ]);
        $category = $this->requireRow('SELECT id FROM service_categories WHERE public_id = :id', ['id' => $data['categoryId']], 'Categoria não encontrada.');
        $publicId = Uuid::v4();
        $slug = $data['slug'] ?? $this->slug((string) $data['name']);
        $this->db->prepare(
            'INSERT INTO services
                (public_id, category_id, name, slug, short_description, description, pricing_type, price_cents,
                 unit_label, default_duration_minutes, minimum_quantity, maximum_quantity, active, created_at, updated_at)
             VALUES (:public_id, :category_id, :name, :slug, :short_description, :description, :pricing_type,
                     :price, :unit_label, :duration, 1, 10000, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        )->execute([
            'public_id' => $publicId, 'category_id' => $category['id'], 'name' => $data['name'], 'slug' => $slug,
            'short_description' => $data['shortDescription'] ?? null, 'description' => $data['description'] ?? null,
            'pricing_type' => $data['pricingType'], 'price' => $data['priceCents'], 'unit_label' => $data['unitLabel'] ?? null,
            'duration' => $data['defaultDurationMinutes'],
        ]);
        return Response::data(['id' => $publicId, 'name' => $data['name'], 'slug' => $slug], 201);
    }

    public function updateService(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, [
            'name' => ['sometimes', 'string', 'min:2', 'max:120'], 'shortDescription' => ['sometimes', 'nullable', 'string', 'max:250'],
            'description' => ['sometimes', 'nullable', 'string', 'max:4000'], 'pricingType' => ['sometimes', 'string', 'in:fixed,hourly,area'],
            'priceCents' => ['sometimes', 'integer', 'min:100', 'max:10000000'], 'unitLabel' => ['sometimes', 'nullable', 'string', 'max:30'],
            'defaultDurationMinutes' => ['sometimes', 'integer', 'min:30', 'max:1440'], 'active' => ['sometimes', 'boolean'],
        ]);
        $map = [
            'name' => 'name', 'shortDescription' => 'short_description', 'description' => 'description', 'pricingType' => 'pricing_type',
            'priceCents' => 'price_cents', 'unitLabel' => 'unit_label', 'defaultDurationMinutes' => 'default_duration_minutes', 'active' => 'active',
        ];
        $this->dynamicUpdate('services', $params['id'], $data, $map);
        return Response::data(['id' => $params['id']] + $data);
    }

    public function promotions(Request $request, array $params, ?array $auth): Response
    {
        return Response::data($this->db->query(
            'SELECT public_id AS id, title, subtitle, cta_label AS ctaLabel, cta_url AS ctaUrl,
                    image_url AS imageUrl, badge_text AS badgeText, terms_text AS termsText,
                    background_color AS backgroundColor, text_color AS textColor, active, starts_at AS startsAt,
                    ends_at AS endsAt, sort_order AS sortOrder FROM promotions ORDER BY sort_order, created_at DESC'
        )->fetchAll());
    }

    public function createPromotion(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, [
            'title' => ['required', 'string', 'min:3', 'max:160'], 'subtitle' => ['nullable', 'string', 'max:300'],
            'ctaLabel' => ['nullable', 'string', 'max:60'], 'ctaUrl' => ['nullable', 'string', 'max:255'],
            'imageUrl' => ['nullable', 'string', 'max:1024'], 'badgeText' => ['nullable', 'string', 'max:80'],
            'termsText' => ['nullable', 'string', 'max:300'],
            'backgroundColor' => ['nullable', 'string', 'max:20'], 'textColor' => ['nullable', 'string', 'max:20'],
            'startsAt' => ['nullable', 'date'], 'endsAt' => ['nullable', 'date'], 'sortOrder' => ['nullable', 'integer', 'min:0', 'max:999'],
        ]);
        $this->validateWebPath($data['ctaUrl'] ?? null);
        $this->validateWebPath($data['imageUrl'] ?? null);
        $publicId = Uuid::v4();
        $this->db->prepare(
            'INSERT INTO promotions
                (public_id, title, subtitle, cta_label, cta_url, image_url, badge_text, terms_text, background_color, text_color, active, starts_at, ends_at, sort_order, created_at, updated_at)
             VALUES (:public_id, :title, :subtitle, :cta_label, :cta_url, :image_url, :badge_text, :terms_text, :background_color, :text_color, 1,
                     :starts_at, :ends_at, :sort_order, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        )->execute([
            'public_id' => $publicId, 'title' => $data['title'], 'subtitle' => $data['subtitle'] ?? null,
            'cta_label' => $data['ctaLabel'] ?? null, 'cta_url' => $data['ctaUrl'] ?? null,
            'image_url' => $data['imageUrl'] ?? null, 'badge_text' => $data['badgeText'] ?? null,
            'terms_text' => $data['termsText'] ?? null,
            'background_color' => $data['backgroundColor'] ?? '#08B86F', 'text_color' => $data['textColor'] ?? '#FFFFFF',
            'starts_at' => $data['startsAt'] ?? null, 'ends_at' => $data['endsAt'] ?? null, 'sort_order' => $data['sortOrder'] ?? 0,
        ]);
        return Response::data(['id' => $publicId] + $data, 201);
    }

    public function updatePromotion(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, [
            'title' => ['sometimes', 'string', 'min:3', 'max:160'], 'subtitle' => ['sometimes', 'nullable', 'string', 'max:300'],
            'ctaLabel' => ['sometimes', 'nullable', 'string', 'max:60'], 'ctaUrl' => ['sometimes', 'nullable', 'string', 'max:255'],
            'imageUrl' => ['sometimes', 'nullable', 'string', 'max:1024'], 'badgeText' => ['sometimes', 'nullable', 'string', 'max:80'],
            'termsText' => ['sometimes', 'nullable', 'string', 'max:300'], 'backgroundColor' => ['sometimes', 'string', 'max:20'],
            'textColor' => ['sometimes', 'string', 'max:20'], 'active' => ['sometimes', 'boolean'],
            'startsAt' => ['sometimes', 'nullable', 'date'], 'endsAt' => ['sometimes', 'nullable', 'date'],
            'sortOrder' => ['sometimes', 'integer', 'min:0', 'max:999'],
        ]);
        $this->validateWebPath($data['ctaUrl'] ?? null);
        $this->validateWebPath($data['imageUrl'] ?? null);
        $map = [
            'title' => 'title', 'subtitle' => 'subtitle', 'ctaLabel' => 'cta_label', 'ctaUrl' => 'cta_url',
            'imageUrl' => 'image_url', 'badgeText' => 'badge_text', 'termsText' => 'terms_text',
            'backgroundColor' => 'background_color', 'textColor' => 'text_color', 'active' => 'active',
            'startsAt' => 'starts_at', 'endsAt' => 'ends_at', 'sortOrder' => 'sort_order',
        ];
        $this->dynamicUpdate('promotions', $params['id'], $data, $map);
        return Response::data(['id' => $params['id']] + $data);
    }

    public function products(Request $request, array $params, ?array $auth): Response
    {
        return Response::data($this->db->query(
            'SELECT public_id AS id, name, slug, short_description AS shortDescription,
                    price_cents AS priceCents, compare_at_price_cents AS compareAtPriceCents, currency,
                    image_url AS imageUrl, purchase_url AS purchaseUrl, badge_text AS badgeText,
                    inventory_count AS inventoryCount, featured, active, sort_order AS sortOrder
             FROM products ORDER BY sort_order, created_at DESC'
        )->fetchAll());
    }

    public function createProduct(Request $request, array $params, ?array $auth): Response
    {
        $data = $this->validatedProduct($request->body, false);
        $publicId = Uuid::v4();
        $slug = !empty($data['slug']) ? $this->slug((string) $data['slug']) : $this->slug((string) $data['name']);
        $this->db->prepare(
            'INSERT INTO products
                (public_id, name, slug, short_description, price_cents, compare_at_price_cents, currency,
                 image_url, purchase_url, badge_text, inventory_count, featured, active, sort_order, created_at, updated_at)
             VALUES (:public_id, :name, :slug, :short_description, :price_cents, :compare_at_price_cents, :currency,
                     :image_url, :purchase_url, :badge_text, :inventory_count, :featured, :active, :sort_order, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        )->execute([
            'public_id' => $publicId, 'name' => $data['name'], 'slug' => $slug,
            'short_description' => $data['shortDescription'] ?? null, 'price_cents' => $data['priceCents'],
            'compare_at_price_cents' => $data['compareAtPriceCents'] ?? null, 'currency' => $data['currency'] ?? 'BRL',
            'image_url' => $data['imageUrl'] ?? null, 'purchase_url' => $data['purchaseUrl'],
            'badge_text' => $data['badgeText'] ?? null, 'inventory_count' => $data['inventoryCount'] ?? 0,
            'featured' => !empty($data['featured']) ? 1 : 0, 'active' => array_key_exists('active', $data) && !$data['active'] ? 0 : 1,
            'sort_order' => $data['sortOrder'] ?? 0,
        ]);
        return Response::data(['id' => $publicId, 'slug' => $slug] + $data, 201);
    }

    public function updateProduct(Request $request, array $params, ?array $auth): Response
    {
        $data = $this->validatedProduct($request->body, true);
        if (isset($data['slug'])) {
            $data['slug'] = $this->slug((string) $data['slug']);
        }
        $map = [
            'name' => 'name', 'slug' => 'slug', 'shortDescription' => 'short_description', 'priceCents' => 'price_cents',
            'compareAtPriceCents' => 'compare_at_price_cents', 'currency' => 'currency', 'imageUrl' => 'image_url',
            'purchaseUrl' => 'purchase_url', 'badgeText' => 'badge_text', 'inventoryCount' => 'inventory_count',
            'featured' => 'featured', 'active' => 'active', 'sortOrder' => 'sort_order',
        ];
        $this->dynamicUpdate('products', $params['id'], $data, $map);
        return Response::data(['id' => $params['id']] + $data);
    }

    public function auditLogs(Request $request, array $params, ?array $auth): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request, 50, 100);
        $rows = $this->db->query(
            "SELECT a.id, u.public_id AS actorId, u.name AS actorName, a.action, a.entity_type AS entityType,
                    a.entity_public_id AS entityId, a.ip_address AS ipAddress, a.request_id AS requestId,
                    a.metadata, a.created_at AS createdAt
             FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.created_at DESC LIMIT {$perPage} OFFSET {$offset}"
        )->fetchAll();
        foreach ($rows as &$row) {
            $row['metadata'] = $row['metadata'] ? json_decode($row['metadata'], true) : null;
        }
        unset($row);
        return Response::data($rows, 200, ['page' => $page, 'perPage' => $perPage]);
    }

    public function contentReports(Request $request, array $params, ?array $auth): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request, 30, 100);
        $where = '';
        $values = [];
        if (in_array(($request->query['status'] ?? ''), ['pending', 'resolved', 'dismissed'], true)) {
            $where = 'WHERE cr.status = :status';
            $values['status'] = $request->query['status'];
        }
        $count = $this->db->prepare("SELECT COUNT(*) FROM content_reports cr {$where}");
        $count->execute($values);
        $total = (int) $count->fetchColumn();
        $statement = $this->db->prepare(
            "SELECT cr.public_id AS id, cr.content_type AS contentType, cr.content_public_id AS contentId, cr.reason, cr.status, cr.action,
                    cr.created_at AS createdAt, u.name AS reporterName
             FROM content_reports cr INNER JOIN users u ON u.id = cr.reporter_id {$where}
             ORDER BY FIELD(cr.status, 'pending', 'resolved', 'dismissed'), cr.created_at ASC LIMIT {$perPage} OFFSET {$offset}"
        );
        $statement->execute($values);
        return Response::data($statement->fetchAll(), 200, ['page' => $page, 'perPage' => $perPage, 'total' => $total, 'lastPage' => max(1, (int) ceil($total / $perPage))]);
    }

    public function resolveContentReport(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, [
            'action' => ['required', 'string', 'in:hide,retain'],
            'note' => ['required', 'string', 'min:3', 'max:1000'],
        ]);
        $this->db->beginTransaction();
        try {
            $report = $this->requireRow('SELECT id, reporter_id, content_type AS contentType, content_public_id AS contentId, status FROM content_reports WHERE public_id = :id FOR UPDATE', ['id' => $params['id']], 'Denúncia não encontrada.');
            if ($report['status'] !== 'pending') {
                throw new ApiException(409, 'REPORT_ALREADY_RESOLVED', 'Esta denúncia já foi resolvida.');
            }
            $action = (string) $data['action'];
            if ($action === 'hide') {
                $table = match ($report['contentType']) {
                    'professional_comment' => 'professional_comments',
                    'review' => 'reviews',
                    default => throw new ApiException(422, 'MESSAGE_HIDE_UNSUPPORTED', 'Mensagens exigem tratamento operacional e não podem ser ocultadas por esta ação.'),
                };
                $hidden = $this->db->prepare("UPDATE {$table} SET status = 'hidden', updated_at = UTC_TIMESTAMP() WHERE public_id = :id");
                $hidden->execute(['id' => $report['contentId']]);
                if ($hidden->rowCount() === 0) {
                    throw new ApiException(404, 'REPORTED_CONTENT_NOT_FOUND', 'O conteúdo denunciado não está mais disponível.');
                }
            }
            $this->db->prepare('UPDATE content_reports SET status = :status, action = :action, resolved_by = :resolver, resolved_at = UTC_TIMESTAMP(), resolution_note = :note, updated_at = UTC_TIMESTAMP() WHERE id = :id')
                ->execute([
                    'status' => $action === 'hide' ? 'resolved' : 'dismissed', 'action' => $action === 'hide' ? 'hidden' : 'retained',
                    'resolver' => $auth['id'], 'note' => trim(strip_tags((string) $data['note'])), 'id' => $report['id'],
                ]);
            $this->notify(
                (int) $report['reporter_id'],
                'report.resolved',
                'Denúncia analisada',
                $action === 'hide' ? 'A equipe removeu o conteúdo informado na sua denúncia.' : 'A equipe analisou sua denúncia e manteve o conteúdo publicado.',
                ['reportId' => $params['id']]
            );
            $this->audit->record((int) $auth['id'], 'admin.content_report_resolved', 'content_report', $params['id'], $request, ['action' => $action]);
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
        return Response::data(['id' => $params['id'], 'status' => $action === 'hide' ? 'resolved' : 'dismissed', 'action' => $action]);
    }

    private function dynamicUpdate(string $table, string $publicId, array $data, array $map): void
    {
        if ($data === []) {
            throw new ApiException(422, 'NO_CHANGES', 'Informe ao menos um campo para atualizar.');
        }
        $sets = [];
        $values = ['id' => $publicId];
        foreach ($data as $field => $value) {
            $sets[] = $map[$field] . ' = :' . $field;
            $values[$field] = is_bool($value) ? (int) $value : $value;
        }
        $statement = $this->db->prepare("UPDATE {$table} SET " . implode(', ', $sets) . ', updated_at = UTC_TIMESTAMP() WHERE public_id = :id');
        $statement->execute($values);
        if ($statement->rowCount() === 0) {
            $exists = $this->db->prepare("SELECT 1 FROM {$table} WHERE public_id = :id");
            $exists->execute(['id' => $publicId]);
            if (!$exists->fetchColumn()) {
                throw new ApiException(404, 'NOT_FOUND', 'Registro não encontrado.');
            }
        }
    }

    private function validatedProduct(array $body, bool $partial): array
    {
        $presence = $partial ? 'sometimes' : 'required';
        $data = Validator::validate($body, [
            'name' => [$presence, 'string', 'min:2', 'max:160'], 'slug' => ['sometimes', 'nullable', 'string', 'max:180'],
            'shortDescription' => ['sometimes', 'nullable', 'string', 'max:300'],
            'priceCents' => [$presence, 'integer', 'min:1', 'max:100000000'],
            'compareAtPriceCents' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:100000000'],
            'currency' => ['sometimes', 'string', 'in:BRL,EUR,USD'], 'imageUrl' => ['sometimes', 'nullable', 'string', 'max:1024'],
            'purchaseUrl' => [$presence, 'string', 'min:1', 'max:1024'], 'badgeText' => ['sometimes', 'nullable', 'string', 'max:80'],
            'inventoryCount' => ['sometimes', 'integer', 'min:0', 'max:1000000'], 'featured' => ['sometimes', 'boolean'],
            'active' => ['sometimes', 'boolean'], 'sortOrder' => ['sometimes', 'integer', 'min:0', 'max:999'],
        ]);
        foreach (['imageUrl', 'purchaseUrl'] as $field) {
            $this->validateWebPath($data[$field] ?? null);
        }
        return $data;
    }

    private function validateWebPath(mixed $value): void
    {
        if (is_string($value) && $value !== '' && preg_match('#^(?:/|https://)#i', $value) !== 1) {
            throw new ApiException(422, 'INVALID_URL', 'Use um endereço interno iniciado por / ou um endereço HTTPS.');
        }
    }

    private function slug(string $value): string
    {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
        return trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($ascii)) ?? '', '-');
    }
}
