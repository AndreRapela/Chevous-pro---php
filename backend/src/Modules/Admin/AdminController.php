<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Admin;

use ChezVoust\Modules\Catalog\PromotionVideo;

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Audit;
use ChezVoust\Core\Controller;
use ChezVoust\Core\PublicReadLimiter;
use ChezVoust\Core\Request;
use ChezVoust\Core\Response;
use ChezVoust\Core\Uuid;
use ChezVoust\Core\Validator;
use PDO;
use Throwable;

final class AdminController extends Controller
{
    public function __construct(PDO $db, array $config, private readonly Audit $audit, private readonly PromotionUploads $uploads)
    {
        parent::__construct($db, $config);
    }

    public function dashboard(Request $request, array $params, ?array $auth): Response
    {
        $metricsStatement = $this->db->prepare(
            'SELECT
                (SELECT COUNT(*) FROM users WHERE role = \'customer\' AND deleted_at IS NULL) AS customers,
                (SELECT COUNT(*) FROM users WHERE role = \'provider\' AND deleted_at IS NULL) AS professionals,
                (SELECT COUNT(*) FROM professional_profiles p INNER JOIN users u ON u.id = p.user_id
                  WHERE p.verification_status = \'pending\' AND u.status = \'active\' AND u.deleted_at IS NULL) AS professionalsPending,
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
        $where = ['u.deleted_at IS NULL'];
        $values = [];
        if (!empty($request->query['role'])) {
            $where[] = 'u.role = :role';
            $values['role'] = (string) $request->query['role'];
        }
        if (!empty($request->query['status'])) {
            $where[] = 'u.status = :status';
            $values['status'] = (string) $request->query['status'];
        }
        if (!empty($request->query['q'])) {
            $where[] = '(u.name LIKE :q_name OR u.email LIKE :q_email)';
            $search = '%' . mb_substr((string) $request->query['q'], 0, 100) . '%';
            $values['q_name'] = $search;
            $values['q_email'] = $search;
        }
        $whereSql = implode(' AND ', $where);
        $count = $this->db->prepare("SELECT COUNT(*) FROM users u WHERE {$whereSql}");
        $count->execute($values);
        $total = (int) $count->fetchColumn();
        $order = ($values['role'] ?? null) === 'provider'
            ? "(p.verification_status = 'pending' AND u.status = 'active') DESC, u.created_at DESC, u.id DESC"
            : 'u.created_at DESC, u.id DESC';
        $statement = $this->db->prepare(
            "SELECT u.public_id AS id, u.role, u.name, u.email, u.phone, u.status, u.email_verified_at AS emailVerifiedAt,
                    u.last_login_at AS lastLoginAt, u.created_at AS createdAt, p.headline, p.base_city AS city,
                    p.base_state AS state, p.verification_status AS verificationStatus
             FROM users u LEFT JOIN professional_profiles p ON p.user_id = u.id
             WHERE {$whereSql} ORDER BY {$order} LIMIT {$perPage} OFFSET {$offset}"
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
        $this->db->beginTransaction();
        try {
            $user = $this->requireRow('SELECT id, public_id FROM users WHERE public_id = :id AND deleted_at IS NULL FOR UPDATE', ['id' => $params['id']], 'Usuário não encontrado.');
            if ((int) $user['id'] === (int) $auth['id']) {
                throw new ApiException(422, 'SELF_STATUS_CHANGE', 'Você não pode suspender sua própria conta administrativa.');
            }
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

    public function deleteUser(Request $request, array $params, ?array $auth): Response
    {
        $this->db->beginTransaction();
        try {
            $user = $this->requireRow(
                'SELECT id, public_id, role, deleted_at FROM users WHERE public_id = :id FOR UPDATE',
                ['id' => $params['id']],
                'Usuário não encontrado.'
            );
            if (!in_array($user['role'], ['customer', 'provider'], true)) {
                throw new ApiException(403, 'ADMIN_ACCOUNT_PROTECTED', 'Contas administrativas estão protegidas contra exclusão.');
            }
            if ($user['deleted_at'] === null) {
                // Keep historical relationships and release the original address for a new registration.
                $this->db->prepare(
                    "UPDATE users SET status = 'suspended', email = :retired_email, password_hash = '',
                            phone = NULL, deleted_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = :id"
                )->execute(['retired_email' => 'deleted:' . $user['public_id'], 'id' => $user['id']]);
                $this->db->prepare('UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = :id AND revoked_at IS NULL')
                    ->execute(['id' => $user['id']]);
                $this->audit->record((int) $auth['id'], 'admin.user_deleted', 'user', $user['public_id'], $request, ['role' => $user['role']]);
            }
            $this->db->commit();
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
        return Response::noContent();
    }

    public function pendingProfessionals(Request $request, array $params, ?array $auth): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request, 30, 100);
        $total = (int) $this->db->query(
            'SELECT COUNT(*) FROM professional_profiles p INNER JOIN users u ON u.id = p.user_id
             WHERE p.verification_status = \'pending\' AND u.status = \'active\' AND u.deleted_at IS NULL'
        )->fetchColumn();
        $rows = $this->db->query(
            'SELECT u.public_id AS id, u.name, u.email, u.phone, p.headline, p.bio,
                    p.base_city AS city, p.base_state AS state, p.years_experience AS yearsExperience,
                    p.verification_status AS verificationStatus, p.created_at AS createdAt
             FROM professional_profiles p INNER JOIN users u ON u.id = p.user_id
             WHERE p.verification_status = \'pending\' AND u.status = \'active\' AND u.deleted_at IS NULL
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
            'SELECT u.id, u.public_id FROM users u INNER JOIN professional_profiles p ON p.user_id = u.id WHERE u.public_id = :id AND u.deleted_at IS NULL',
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
        $promotions = $this->db->query(
            'SELECT public_id AS id, placement, service_public_id AS serviceId, title, subtitle, cta_label AS ctaLabel, cta_url AS ctaUrl,
                    image_url AS imageUrl, media_type AS mediaType, media_frame AS mediaFrame, button_placement AS buttonPlacement,
                    video_duration_ms AS videoDurationMs, rotation_weight AS rotationWeight,
                    secondary_links AS secondaryLinks, badge_text AS badgeText, terms_text AS termsText,
                    background_color AS backgroundColor, text_color AS textColor, active, starts_at AS startsAt,
                    ends_at AS endsAt, sort_order AS sortOrder FROM promotions ORDER BY sort_order, created_at DESC, promotions.id DESC'
        )->fetchAll();
        foreach ($promotions as &$promotion) {
            $promotion['mediaFrame'] = isset($promotion['mediaFrame']) ? json_decode($promotion['mediaFrame'], true) : null;
            $promotion['secondaryLinks'] = is_string($promotion['secondaryLinks'] ?? null)
                ? (json_decode($promotion['secondaryLinks'], true) ?: [])
                : [];
        }
        unset($promotion);
        register_shutdown_function(function (): void {
            try {
                ignore_user_abort(true);
                if (function_exists('fastcgi_finish_request')) {
                    fastcgi_finish_request();
                }
                $this->uploads->cleanUp();
                (new PublicReadLimiter(dirname(__DIR__, 3) . '/storage/rate-limits'))->prune();
            } catch (Throwable $failure) {
                error_log('[ChezVoust Pro] Falha na limpeza de campanhas: ' . $failure::class);
            }
        });
        return Response::data($promotions);
    }

    public function createPromotion(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, [
            'title' => ['required', 'string', 'min:3', 'max:160'], 'subtitle' => ['nullable', 'string', 'max:300'],
            'placement' => ['sometimes', 'string', 'in:home,services'], 'serviceId' => ['sometimes', 'nullable', 'uuid'],
            'ctaLabel' => ['nullable', 'string', 'max:60'], 'ctaUrl' => ['nullable', 'string', 'max:255'],
            'imageUrl' => ['nullable', 'string', 'max:1024'], 'badgeText' => ['nullable', 'string', 'max:80'],
            'mediaType' => ['nullable', 'string', 'in:image,video'],
            'mediaFrame' => ['nullable', 'array'],
            'videoDurationMs' => ['nullable', 'integer', 'min:1', 'max:60000'],
            'rotationWeight' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'buttonPlacement' => ['nullable', 'string', 'in:banner,below,both'],
            'active' => ['sometimes', 'boolean'],
            'termsText' => ['nullable', 'string', 'max:300'],
            'backgroundColor' => ['nullable', 'string', 'max:20'], 'textColor' => ['nullable', 'string', 'max:20'],
            'startsAt' => ['nullable', 'date'], 'endsAt' => ['nullable', 'date'], 'sortOrder' => ['nullable', 'integer', 'min:0', 'max:999'],
        ]);
        $this->validateWebPath($data['ctaUrl'] ?? null);
        $this->validateWebPath($data['imageUrl'] ?? null);
        $secondaryLinks = $this->validatePromotionLinks($request->body['secondaryLinks'] ?? []);
        $publicId = Uuid::v4();
        $publication = $this->writePromotion($publicId, $data, function (array $publication) use ($data, $publicId, $secondaryLinks): void {
          $this->db->prepare(
            'INSERT INTO promotions
                (public_id, placement, service_public_id, title, subtitle, cta_label, cta_url, image_url, media_type, media_frame, video_duration_ms, rotation_weight, button_placement, secondary_links, badge_text, terms_text, background_color, text_color, active, starts_at, ends_at, sort_order, created_at, updated_at)
             VALUES (:public_id, :placement, :service_public_id, :title, :subtitle, :cta_label, :cta_url, :image_url, :media_type, :media_frame, :video_duration_ms, :rotation_weight, :button_placement, :secondary_links, :badge_text, :terms_text, :background_color, :text_color, :active,
                     :starts_at, :ends_at, :sort_order, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        )->execute([
            'public_id' => $publicId, 'title' => $data['title'], 'subtitle' => $data['subtitle'] ?? null,
            'placement' => $publication['placement'], 'service_public_id' => $publication['serviceId'],
            'cta_label' => $data['ctaLabel'] ?? null, 'cta_url' => $data['ctaUrl'] ?? null,
            'image_url' => $data['imageUrl'] ?? null, 'media_type' => $data['mediaType'] ?? 'image',
            'media_frame' => $this->encodeMediaFrame($data['mediaFrame'] ?? null),
            'video_duration_ms' => $publication['videoDurationMs'], 'rotation_weight' => $data['rotationWeight'] ?? 3,
            'button_placement' => $data['buttonPlacement'] ?? 'banner',
            'secondary_links' => $secondaryLinks === [] ? null : json_encode($secondaryLinks, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'badge_text' => $data['badgeText'] ?? null,
            'terms_text' => $data['termsText'] ?? null,
            'background_color' => $data['backgroundColor'] ?? '#08B86F', 'text_color' => $data['textColor'] ?? '#FFFFFF',
            'active' => (int) ($data['active'] ?? true),
            'starts_at' => $data['startsAt'] ?? null, 'ends_at' => $data['endsAt'] ?? null, 'sort_order' => $data['sortOrder'] ?? 0,
          ]);
        }, create: true);
        return Response::data(['id' => $publicId] + $publication + $data, 201);
    }

    public function updatePromotion(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, [
            'title' => ['sometimes', 'string', 'min:3', 'max:160'], 'subtitle' => ['sometimes', 'nullable', 'string', 'max:300'],
            'placement' => ['sometimes', 'string', 'in:home,services'], 'serviceId' => ['sometimes', 'nullable', 'uuid'],
            'ctaLabel' => ['sometimes', 'nullable', 'string', 'max:60'], 'ctaUrl' => ['sometimes', 'nullable', 'string', 'max:255'],
            'imageUrl' => ['sometimes', 'nullable', 'string', 'max:1024'], 'badgeText' => ['sometimes', 'nullable', 'string', 'max:80'],
            'mediaType' => ['sometimes', 'string', 'in:image,video'],
            'mediaFrame' => ['sometimes', 'nullable', 'array'],
            'videoDurationMs' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:60000'],
            'rotationWeight' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'buttonPlacement' => ['sometimes', 'string', 'in:banner,below,both'],
            'secondaryLinks' => ['sometimes', 'array', 'max:3'],
            'termsText' => ['sometimes', 'nullable', 'string', 'max:300'], 'backgroundColor' => ['sometimes', 'string', 'max:20'],
            'textColor' => ['sometimes', 'string', 'max:20'], 'active' => ['sometimes', 'boolean'],
            'startsAt' => ['sometimes', 'nullable', 'date'], 'endsAt' => ['sometimes', 'nullable', 'date'],
            'sortOrder' => ['sometimes', 'integer', 'min:0', 'max:999'],
        ]);
        $this->validateWebPath($data['ctaUrl'] ?? null);
        $this->validateWebPath($data['imageUrl'] ?? null);
        if (array_key_exists('secondaryLinks', $data)) {
            $data['secondaryLinks'] = $this->validatePromotionLinks($data['secondaryLinks']);
        }
        $map = [
            'title' => 'title', 'subtitle' => 'subtitle', 'ctaLabel' => 'cta_label', 'ctaUrl' => 'cta_url',
            'placement' => 'placement', 'serviceId' => 'service_public_id',
            'imageUrl' => 'image_url', 'mediaType' => 'media_type', 'mediaFrame' => 'media_frame', 'buttonPlacement' => 'button_placement',
            'videoDurationMs' => 'video_duration_ms', 'rotationWeight' => 'rotation_weight',
            'secondaryLinks' => 'secondary_links', 'badgeText' => 'badge_text', 'termsText' => 'terms_text',
            'backgroundColor' => 'background_color', 'textColor' => 'text_color', 'active' => 'active',
            'startsAt' => 'starts_at', 'endsAt' => 'ends_at', 'sortOrder' => 'sort_order',
        ];
        if (array_key_exists('secondaryLinks', $data)) {
            $data['secondaryLinks'] = $data['secondaryLinks'] === [] ? null : json_encode($data['secondaryLinks'], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        $values = $data;
        if (array_key_exists('mediaFrame', $data)) {
            $values['mediaFrame'] = $this->encodeMediaFrame($data['mediaFrame']);
        }
        $publication = $this->writePromotion($params['id'], $data, function (array $publication) use ($params, $values, $map): void {
            if ($values !== []) $values = $publication + $values;
            $this->dynamicUpdate('promotions', $params['id'], $values, $map);
        });
        return Response::data(['id' => $params['id']] + $publication + $data);
    }

    private function writePromotion(string $id, array $data, callable $write, bool $create = false): array
    {
        return $this->uploads->withCampaignLock(function () use ($id, $data, $write, $create): array {
            $select = 'SELECT placement, service_public_id, media_type, image_url, video_duration_ms, cta_url, media_frame, secondary_links
                       FROM promotions WHERE public_id = :id';
            $current = $create ? [] : $this->requireRow($select, ['id' => $id]);
            $placement = $data['placement'] ?? $current['placement'] ?? 'home';
            $previousService = $current['service_public_id'] ?? null;
            $serviceId = array_key_exists('serviceId', $data) ? $data['serviceId'] : $previousService;
            if ($placement === 'home') $serviceId = null;
            if ($serviceId !== null && $serviceId !== $previousService) {
                $this->requireRow('SELECT id FROM services WHERE public_id = :id', ['id' => $serviceId], 'Serviço não encontrado.');
            }
            $type = $data['mediaType'] ?? ($current['media_type'] ?? 'image');
            $url = array_key_exists('imageUrl', $data) ? $data['imageUrl'] : ($current['image_url'] ?? null);
            $duration = null;
            if (PromotionVideo::hasSource($type, $url)) {
                $alreadyVideo = PromotionVideo::hasSource($current['media_type'] ?? null, $current['image_url'] ?? null);
                if (!$alreadyVideo && (int) $this->db->query(
                    "SELECT COUNT(*) FROM promotions WHERE media_type = 'video' AND TRIM(image_url) <> ''"
                )->fetchColumn() >= PromotionVideo::LIMIT) {
                    throw new ApiException(422, 'PROMOTION_VIDEO_LIMIT', 'É possível cadastrar no máximo 10 vídeos de campanha.');
                }
                $duration = $alreadyVideo && $url === $current['image_url']
                    ? (isset($current['video_duration_ms']) ? (int) $current['video_duration_ms'] : null)
                    : $this->promotionDuration($url, $data['videoDurationMs'] ?? null);
            }
            $publication = ['videoDurationMs' => $duration, 'placement' => $placement, 'serviceId' => $serviceId];
            $this->db->beginTransaction();
            try {
                $write($publication);
                $saved = $this->requireRow($select, ['id' => $id]);
                $this->uploads->attachNewReferences($saved, $current, $this->config['url']);
                $this->db->commit();
            } catch (Throwable $failure) {
                if ($this->db->inTransaction()) {
                    $this->db->rollBack();
                }
                throw $failure;
            }
            return $publication;
        });
    }

    private function promotionDuration(string $url, mixed $declared): int
    {
        if (preg_match('#^/api/v1/promotion-media/([a-f0-9]{48}\.(mp4|webm))$#D', $url, $match) === 1) {
            $path = $this->uploads->path($match[1]);
            if ($path !== null) {
                return PromotionVideo::requireDuration(PromotionVideo::duration($path, $match[2]));
            }
        }
        return PromotionVideo::requireDuration(isset($declared) ? (int) $declared : null);
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
        $write = function () use ($data, $publicId, $slug): void {
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
        };
        $this->uploads->writeProductReferences([$data['imageUrl'] ?? null, $data['purchaseUrl']], $this->config['url'], $write);
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
        $this->uploads->writeProductReferences(
            [$data['imageUrl'] ?? null, $data['purchaseUrl'] ?? null],
            $this->config['url'],
            fn () => $this->dynamicUpdate('products', $params['id'], $data, $map)
        );
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

    private function validatePromotionLinks(mixed $links): array
    {
        if (!is_array($links) || count($links) > 3) {
            throw new ApiException(422, 'INVALID_PROMOTION_LINKS', 'Adicione no máximo três links à campanha.');
        }

        $validated = [];
        foreach ($links as $link) {
            if (!is_array($link) || !is_string($link['label'] ?? null) || !is_string($link['url'] ?? null)) {
                throw new ApiException(422, 'INVALID_PROMOTION_LINK', 'Cada link precisa de um texto e um destino.');
            }
            $label = trim($link['label']);
            $url = trim($link['url']);
            if ($label === '' || mb_strlen($label) > 40 || $url === '' || mb_strlen($url) > 255) {
                throw new ApiException(422, 'INVALID_PROMOTION_LINK', 'Informe o texto e o destino de cada link (até 40 caracteres no texto).');
            }
            $this->validateWebPath($url);
            $placement = Validator::validate($link, ['placement' => ['sometimes', 'string', 'in:banner,below,both']]);
            $validated[] = ['label' => $label, 'url' => $url, 'placement' => $placement['placement'] ?? 'below'];
        }
        return $validated;
    }

    private function encodeMediaFrame(?array $frame): ?string
    {
        if ($frame === null) {
            return null;
        }

        $validated = Validator::validate($frame, [
            'fit' => ['required', 'string', 'in:contain,cover'],
            'x' => ['required', 'integer', 'min:0', 'max:100'],
            'y' => ['required', 'integer', 'min:0', 'max:100'],
            'size' => ['sometimes', 'integer', 'min:40', 'max:100'],
            'layout' => ['sometimes', 'string', 'in:side,background'],
            'posterUrl' => ['sometimes', 'nullable', 'string', 'max:1024'],
            'backgroundKey' => ['sometimes', 'nullable', 'array'],
        ]);
        $this->validateWebPath($validated['posterUrl'] ?? null);
        if (isset($validated['backgroundKey'])) {
            $validated['backgroundKey'] = Validator::validate($validated['backgroundKey'], [
                'color' => ['required', 'string', 'regex:/^#[a-fA-F0-9]{6}$/D'],
                'tolerance' => ['required', 'integer', 'min:5', 'max:100'],
            ]);
        }
        return json_encode($validated, JSON_THROW_ON_ERROR);
    }

    private function slug(string $value): string
    {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
        return trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($ascii)) ?? '', '-');
    }
}
