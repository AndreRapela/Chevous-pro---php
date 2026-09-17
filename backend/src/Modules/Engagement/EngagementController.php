<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Engagement;

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Controller;
use ChezVoust\Core\Request;
use ChezVoust\Core\RateLimiter;
use ChezVoust\Core\Response;
use ChezVoust\Core\Uuid;
use ChezVoust\Core\Validator;

final class EngagementController extends Controller
{
    private const CHAT_BOOKING_STATUSES = [
        'confirmed',
        'provider_on_the_way',
        'in_progress',
        'completed',
        'disputed',
    ];

    public function __construct(\PDO $db, array $config, private readonly RateLimiter $rateLimiter)
    {
        parent::__construct($db, $config);
    }

    public function conversations(Request $request, array $params, ?array $auth): Response
    {
        $this->rateLimiter->check(
            'conversations:user:' . $auth['id'],
            $this->config['rate_limit']['conversations_per_user'],
            $this->config['rate_limit']['window']
        );
        $this->rateLimiter->check(
            'conversations:ip:' . $request->ip,
            $this->config['rate_limit']['conversations_per_ip'],
            $this->config['rate_limit']['window']
        );
        [$page, $perPage, $offset] = $this->pagination($request, 30, 100);
        $count = $this->db->prepare('SELECT COUNT(*) FROM conversation_participants WHERE user_id = :user_id');
        $count->execute(['user_id' => $auth['id']]);
        $total = (int) $count->fetchColumn();
        $statement = $this->db->prepare(
            "SELECT c.public_id AS id, COALESCE(b.public_id, '') AS bookingId,
                    CASE WHEN c.kind = 'inquiry' THEN 'inquiry' ELSE b.status END AS bookingStatus,
                    COALESCE(s.name, 'Contato antes da reserva') AS serviceName, c.updated_at AS updatedAt,
                    contact.name AS contactName, contact.public_id AS contactId,
                    contact.avatar_path AS contactAvatarPath, contact.avatar_updated_at AS contactAvatarUpdatedAt,
                    last_message.body AS lastMessage,
                    (SELECT COUNT(*) FROM messages m
                     WHERE m.conversation_id = c.id AND m.id > COALESCE(cp.last_read_message_id, 0) AND m.sender_id <> :sender_id) AS unreadCount
             FROM conversation_participants cp INNER JOIN conversations c ON c.id = cp.conversation_id
             LEFT JOIN conversation_participants contact_participant
                ON contact_participant.conversation_id = c.id AND contact_participant.user_id <> cp.user_id
             LEFT JOIN users contact ON contact.id = contact_participant.user_id
             LEFT JOIN bookings b ON b.id = c.booking_id LEFT JOIN services s ON s.id = b.service_id
             LEFT JOIN messages last_message ON last_message.id = (
                SELECT MAX(last_message_id.id) FROM messages last_message_id WHERE last_message_id.conversation_id = c.id
             )
             WHERE cp.user_id = :user_id ORDER BY c.updated_at DESC LIMIT " . $perPage . ' OFFSET ' . $offset
        );
        $statement->execute([
            'sender_id' => $auth['id'], 'user_id' => $auth['id'],
        ]);
        $conversations = $statement->fetchAll();
        foreach ($conversations as &$conversation) {
            $conversation['contactAvatarUrl'] = $this->avatarUrl(
                (string) ($conversation['contactId'] ?? ''),
                $conversation['contactAvatarPath'] ?? null,
                $conversation['contactAvatarUpdatedAt'] ?? null
            );
            unset($conversation['contactAvatarPath'], $conversation['contactAvatarUpdatedAt']);
        }
        unset($conversation);
        return Response::data($conversations, 200, [
            'page' => $page, 'perPage' => $perPage, 'total' => $total, 'lastPage' => max(1, (int) ceil($total / $perPage)),
        ]);
    }

    public function favorites(Request $request, array $params, ?array $auth): Response
    {
        $statement = $this->db->prepare(
            'SELECT u.public_id AS id, u.name, p.headline, p.base_city AS city, p.base_state AS state,
                    p.rating_avg AS rating, p.reviews_count AS reviewsCount, f.created_at AS favoritedAt
             FROM favorites f INNER JOIN users u ON u.id = f.professional_id
             INNER JOIN professional_profiles p ON p.user_id = u.id
             WHERE f.customer_id = :id AND u.status = \'active\' AND p.verification_status = \'approved\'
             ORDER BY f.created_at DESC'
        );
        $statement->execute(['id' => $auth['id']]);
        return Response::data($statement->fetchAll());
    }

    public function addFavorite(Request $request, array $params, ?array $auth): Response
    {
        $professional = $this->requireRow(
            'SELECT u.id FROM users u INNER JOIN professional_profiles p ON p.user_id = u.id
             WHERE u.public_id = :id AND u.status = \'active\' AND p.verification_status = \'approved\'',
            ['id' => $params['professionalId']],
            'Profissional não encontrado.'
        );
        $this->db->prepare(
            'INSERT IGNORE INTO favorites (customer_id, professional_id, created_at) VALUES (:customer_id, :professional_id, UTC_TIMESTAMP())'
        )->execute(['customer_id' => $auth['id'], 'professional_id' => $professional['id']]);
        return Response::data(['professionalId' => $params['professionalId'], 'favorite' => true], 201);
    }

    public function removeFavorite(Request $request, array $params, ?array $auth): Response
    {
        $this->db->prepare(
            'DELETE f FROM favorites f INNER JOIN users u ON u.id = f.professional_id
             WHERE f.customer_id = :customer_id AND u.public_id = :professional_id'
        )->execute(['customer_id' => $auth['id'], 'professional_id' => $params['professionalId']]);
        return Response::noContent();
    }

    public function messages(Request $request, array $params, ?array $auth): Response
    {
        $conversation = $this->conversationForUser($params['id'], (int) $auth['id']);
        $after = max(0, (int) ($request->query['after'] ?? 0));
        $before = max(0, (int) ($request->query['before'] ?? 0));
        $limit = max(1, min(100, (int) ($request->query['limit'] ?? 50)));
        if ($before > 0) {
            return Response::data($this->messageRowsBefore((int) $conversation['id'], $before, $limit), 200, ['before' => $before, 'limit' => $limit]);
        }
        return Response::data($this->messageRowsAfter((int) $conversation['id'], $after, $limit), 200, ['after' => $after, 'limit' => $limit]);
    }

    /** Cria uma conversa privada e idempotente antes da contratação. */
    public function startProfessionalConversation(Request $request, array $params, ?array $auth): Response
    {
        $this->requireVerifiedEmail($auth);
        $this->rateLimiter->check('inquiry:user:' . $auth['id'], 12, 3600);
        $professional = $this->requireRow(
            "SELECT u.id FROM users u INNER JOIN professional_profiles p ON p.user_id = u.id
             WHERE u.public_id = :id AND u.role = 'provider' AND u.status = 'active' AND p.verification_status = 'approved'",
            ['id' => $params['id']],
            'Profissional não encontrado.'
        );
        if ((int) $professional['id'] === (int) $auth['id']) {
            throw new ApiException(422, 'OWN_CONVERSATION', 'Você não pode iniciar uma conversa com o próprio perfil.');
        }
        $contactKey = (int) $auth['id'] . ':' . (int) $professional['id'];
        $this->db->beginTransaction();
        try {
            $insert = $this->db->prepare("INSERT INTO conversations (public_id, booking_id, kind, contact_key, created_at, updated_at)
                VALUES (:public_id, NULL, 'inquiry', :contact_key, UTC_TIMESTAMP(), UTC_TIMESTAMP())
                ON DUPLICATE KEY UPDATE updated_at = updated_at");
            $insert->execute(['public_id' => Uuid::v4(), 'contact_key' => $contactKey]);
            $conversation = $this->db->prepare(
                'SELECT id, public_id FROM conversations WHERE contact_key = :contact_key LIMIT 1 FOR UPDATE'
            );
            $conversation->execute(['contact_key' => $contactKey]);
            $created = $insert->rowCount() === 1;
            $existing = $conversation->fetch();
            if (!$existing) {
                throw new \RuntimeException('Não foi possível criar a conversa inicial.');
            }
            $conversationId = (string) $existing['public_id'];
            if ($created) {
                $internalId = (int) $existing['id'];
                $participant = $this->db->prepare('INSERT INTO conversation_participants (conversation_id, user_id, joined_at) VALUES (:conversation_id, :user_id, UTC_TIMESTAMP())');
                $participant->execute(['conversation_id' => $internalId, 'user_id' => $auth['id']]);
                $participant->execute(['conversation_id' => $internalId, 'user_id' => $professional['id']]);
                $this->notify((int) $professional['id'], 'chat.inquiry', 'Novo contato', $auth['name'] . ' iniciou uma conversa sobre seus serviços.', ['conversationId' => $conversationId]);
            }
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
        return Response::data(['conversationId' => $conversationId], 201);
    }

    /**
     * Consulta incremental curta para a conversa ativa. O limite global do
     * bootstrap já protege o IP antes do roteamento; não repetir dois buckets
     * persistentes neste endpoint evita seis operações de banco por polling.
     */
    public function messageUpdates(Request $request, array $params, ?array $auth): Response
    {
        $conversation = $this->conversationForUser($params['id'], (int) $auth['id']);
        $after = max(0, (int) ($request->query['after'] ?? 0));
        $limit = max(1, min(50, (int) ($request->query['limit'] ?? 50)));
        $messages = $this->messageRowsAfter((int) $conversation['id'], $after, $limit);

        return Response::data($messages, 200, [
            'after' => $after,
            'limit' => $limit,
            'pollAfterSeconds' => 10,
        ]);
    }

    /**
     * Entrega mensagens novas imediatamente para a conversa ativa. O fluxo
     * termina em 25s para liberar workers Apache e o cliente reconecta.
     */
    public function messageStream(Request $request, array $params, ?array $auth): Response
    {
        $conversation = $this->conversationForUser($params['id'], (int) $auth['id']);
        $after = max(0, (int) ($request->query['after'] ?? 0));
        $conversationId = (int) $conversation['id'];
        return Response::eventStream(function () use ($conversationId, $after): void {
            @set_time_limit(30);
            $cursor = $after;
            $deadline = microtime(true) + 25;
            echo "retry: 1000\n\n";
            @ob_flush(); flush();
            while (microtime(true) < $deadline && connection_aborted() === 0) {
                $messages = $this->messageRowsAfter($conversationId, $cursor, 50);
                foreach ($messages as $message) {
                    $cursor = max($cursor, (int) $message['sequence']);
                    echo 'event: message' . "\n";
                    echo 'data: ' . json_encode($message, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n\n";
                }
                if ($messages !== []) { @ob_flush(); flush(); }
                usleep(1000000);
            }
            echo "event: keepalive\ndata: {}\n\n";
            @ob_flush(); flush();
        });
    }

    public function sendMessage(Request $request, array $params, ?array $auth): Response
    {
        $this->requireVerifiedEmail($auth);
        $this->rateLimiter->check('chat:user:' . $auth['id'], 30, 60);
        $this->rateLimiter->check('chat:ip:' . $request->ip, 90, 60);
        $data = Validator::validate($request->body, ['body' => ['required', 'string', 'min:1', 'max:4000']]);
        $body = trim(strip_tags((string) $data['body']));
        if ($body === '') {
            throw new ApiException(422, 'EMPTY_MESSAGE', 'A mensagem não pode ficar vazia.');
        }
        if (preg_match('/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?\d[\s().-]?){8,}\d/iu', $body) === 1) {
            throw new ApiException(422, 'CONTACT_DETAILS_NOT_ALLOWED', 'Não envie telefone ou e-mail pelo chat. Use os dados protegidos da reserva.');
        }
        $conversation = $this->conversationForUser($params['id'], (int) $auth['id']);
        if ($conversation['kind'] !== 'inquiry' && !in_array($conversation['booking_status'], self::CHAT_BOOKING_STATUSES, true)) {
            throw new ApiException(409, 'CHAT_UNAVAILABLE', 'O chat não está disponível para esta reserva.');
        }
        $requestHash = hash('sha256', $params['id'] . "\n" . $body);
        $idempotencyKey = trim((string) ($request->headers['idempotency-key'] ?? ''));
        if (strlen($idempotencyKey) > 100) {
            throw new ApiException(422, 'INVALID_IDEMPOTENCY_KEY', 'Chave de idempotência inválida.');
        }
        if ($idempotencyKey !== '') {
            $this->db->prepare(
                'DELETE FROM idempotency_keys WHERE user_id = :user_id AND operation = \'chat.message\'
                 AND idempotency_key = :key AND expires_at <= UTC_TIMESTAMP()'
            )->execute(['user_id' => $auth['id'], 'key' => $idempotencyKey]);
            $existing = $this->db->prepare(
                'SELECT request_hash, response_public_id FROM idempotency_keys
                 WHERE user_id = :user_id AND operation = \'chat.message\' AND idempotency_key = :key LIMIT 1'
            );
            $existing->execute(['user_id' => $auth['id'], 'key' => $idempotencyKey]);
            if ($stored = $existing->fetch()) {
                if (!hash_equals((string) $stored['request_hash'], $requestHash)) {
                    throw new ApiException(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.');
                }
                return Response::data($this->messageByPublicId((string) $stored['response_public_id'], (int) $auth['id']));
            }
        }

        $publicId = Uuid::v4();
        try {
            $this->db->beginTransaction();
            $this->db->prepare(
                'INSERT INTO messages (public_id, conversation_id, sender_id, message_type, body, created_at)
                 VALUES (:public_id, :conversation_id, :sender_id, \'text\', :body, UTC_TIMESTAMP())'
            )->execute(['public_id' => $publicId, 'conversation_id' => $conversation['id'], 'sender_id' => $auth['id'], 'body' => $body]);
            $this->db->prepare('UPDATE conversations SET updated_at = UTC_TIMESTAMP() WHERE id = :id')->execute(['id' => $conversation['id']]);
            $recipients = $this->db->prepare('SELECT user_id FROM conversation_participants WHERE conversation_id = :id AND user_id <> :sender');
            $recipients->execute(['id' => $conversation['id'], 'sender' => $auth['id']]);
            foreach ($recipients->fetchAll() as $recipient) {
                $this->notify((int) $recipient['user_id'], 'chat.message', 'Nova mensagem', $auth['name'] . ' enviou uma mensagem.', ['conversationId' => $params['id']]);
            }
            if ($idempotencyKey !== '') {
                $this->db->prepare(
                    'INSERT INTO idempotency_keys (user_id, operation, idempotency_key, request_hash, response_public_id, created_at, expires_at)
                     VALUES (:user_id, \'chat.message\', :key, :request_hash, :response_id, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))'
                )->execute([
                    'user_id' => $auth['id'], 'key' => $idempotencyKey,
                    'request_hash' => $requestHash, 'response_id' => $publicId,
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
                     WHERE user_id = :user_id AND operation = \'chat.message\' AND idempotency_key = :key LIMIT 1'
                );
                $existing->execute(['user_id' => $auth['id'], 'key' => $idempotencyKey]);
                if ($stored = $existing->fetch()) {
                    if (!hash_equals((string) $stored['request_hash'], $requestHash)) {
                        throw new ApiException(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.');
                    }
                    return Response::data($this->messageByPublicId((string) $stored['response_public_id'], (int) $auth['id']));
                }
            }
            throw $exception;
        }
        return Response::data($this->messageByPublicId($publicId, (int) $auth['id']), 201);
    }

    public function markRead(Request $request, array $params, ?array $auth): Response
    {
        $conversation = $this->conversationForUser($params['id'], (int) $auth['id']);
        $lastId = max(0, (int) ($request->body['lastSequence'] ?? 0));
        $maximum = $this->db->prepare('SELECT COALESCE(MAX(id), 0) FROM messages WHERE conversation_id = :conversation_id');
        $maximum->execute(['conversation_id' => $conversation['id']]);
        $lastId = min($lastId, (int) $maximum->fetchColumn());
        $this->db->prepare(
            'UPDATE conversation_participants SET last_read_message_id = GREATEST(COALESCE(last_read_message_id, 0), :last_id), last_read_at = UTC_TIMESTAMP()
             WHERE conversation_id = :conversation_id AND user_id = :user_id'
        )->execute(['last_id' => $lastId, 'conversation_id' => $conversation['id'], 'user_id' => $auth['id']]);
        return Response::noContent();
    }

    public function notifications(Request $request, array $params, ?array $auth): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request, 30, 100);
        $where = 'user_id = :user_id';
        if (($request->query['unread'] ?? '') === 'true') {
            $where .= ' AND read_at IS NULL';
        }
        $statement = $this->db->prepare(
            "SELECT public_id AS id, type, title, message, data, read_at AS readAt, created_at AS createdAt
             FROM notifications WHERE {$where} ORDER BY created_at DESC LIMIT {$perPage} OFFSET {$offset}"
        );
        $statement->execute(['user_id' => $auth['id']]);
        $rows = $statement->fetchAll();
        foreach ($rows as &$row) {
            $row['data'] = $row['data'] ? json_decode($row['data'], true) : null;
        }
        unset($row);
        $unread = $this->db->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = :id AND read_at IS NULL');
        $unread->execute(['id' => $auth['id']]);
        $totalStatement = $this->db->prepare("SELECT COUNT(*) FROM notifications WHERE {$where}");
        $totalStatement->execute(['user_id' => $auth['id']]);
        $total = (int) $totalStatement->fetchColumn();
        return Response::data($rows, 200, ['page' => $page, 'perPage' => $perPage, 'total' => $total, 'lastPage' => max(1, (int) ceil($total / $perPage)), 'unreadCount' => (int) $unread->fetchColumn()]);
    }

    public function readNotification(Request $request, array $params, ?array $auth): Response
    {
        $this->db->prepare('UPDATE notifications SET read_at = COALESCE(read_at, UTC_TIMESTAMP()) WHERE public_id = :id AND user_id = :user_id')
            ->execute(['id' => $params['id'], 'user_id' => $auth['id']]);
        return Response::noContent();
    }

    public function readAllNotifications(Request $request, array $params, ?array $auth): Response
    {
        $this->db->prepare('UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE user_id = :user_id AND read_at IS NULL')
            ->execute(['user_id' => $auth['id']]);
        return Response::noContent();
    }

    public function professionalReviews(Request $request, array $params, ?array $auth): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request, 20, 50);
        $professional = $this->requireRow(
            'SELECT u.id FROM users u INNER JOIN professional_profiles p ON p.user_id = u.id
             WHERE u.public_id = :id AND u.role = \'provider\' AND u.status = \'active\' AND p.verification_status = \'approved\'',
            ['id' => $params['id']],
            'Profissional não encontrado.'
        );
        $count = $this->db->prepare('SELECT COUNT(*) FROM reviews WHERE professional_id = :id AND status = \'published\'');
        $count->execute(['id' => $professional['id']]);
        $total = (int) $count->fetchColumn();
        $statement = $this->db->prepare(
            "SELECT r.public_id AS id, r.rating, r.comment, r.provider_reply AS providerReply,
                    r.created_at AS createdAt, u.name AS customerName, s.name AS serviceName
             FROM reviews r INNER JOIN users u ON u.id = r.customer_id
             INNER JOIN bookings b ON b.id = r.booking_id INNER JOIN services s ON s.id = b.service_id
             WHERE r.professional_id = :id AND r.status = 'published'
             ORDER BY r.created_at DESC LIMIT {$perPage} OFFSET {$offset}"
        );
        $statement->execute(['id' => $professional['id']]);
        $rows = $statement->fetchAll();
        foreach ($rows as &$row) { $row['customerName'] = $this->publicName((string) $row['customerName']); }
        unset($row);
        return Response::data($rows, 200, ['page' => $page, 'perPage' => $perPage, 'total' => $total, 'lastPage' => max(1, (int) ceil($total / $perPage))]);
    }

    public function professionalComments(Request $request, array $params, ?array $auth): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request, 20, 50);
        $professional = $this->publicProfessional($params['id']);
        $count = $this->db->prepare('SELECT COUNT(*) FROM professional_comments WHERE professional_id = :id AND status = \'published\'');
        $count->execute(['id' => $professional['id']]);
        $total = (int) $count->fetchColumn();
        $statement = $this->db->prepare(
            "SELECT c.public_id AS id, c.body AS comment, c.created_at AS createdAt, u.name AS author
             FROM professional_comments c INNER JOIN users u ON u.id = c.author_id
             WHERE c.professional_id = :id AND c.status = 'published'
             ORDER BY c.created_at DESC LIMIT {$perPage} OFFSET {$offset}"
        );
        $statement->execute(['id' => $professional['id']]);
        $rows = $statement->fetchAll();
        foreach ($rows as &$row) { $row['author'] = $this->publicName((string) $row['author']); }
        unset($row);
        return Response::data($rows, 200, ['page' => $page, 'perPage' => $perPage, 'total' => $total, 'lastPage' => max(1, (int) ceil($total / $perPage))]);
    }

    public function createProfessionalComment(Request $request, array $params, ?array $auth): Response
    {
        $this->requireVerifiedEmail($auth);
        $this->rateLimiter->check('comment:user:' . $auth['id'], 5, 3600);
        $this->rateLimiter->check('comment:ip:' . $request->ip, 15, 3600);
        $data = Validator::validate($request->body, ['comment' => ['required', 'string', 'max:1200']]);
        $comment = trim(strip_tags((string) $data['comment']));
        if (mb_strlen($comment) < 3) {
            throw new ApiException(422, 'INVALID_COMMENT', 'Escreva um comentário com pelo menos 3 caracteres.');
        }
        $professional = $this->publicProfessional($params['id']);
        if ((int) $professional['id'] === (int) $auth['id']) {
            throw new ApiException(422, 'OWN_COMMENT', 'Você não pode comentar no próprio perfil.');
        }
        $recent = $this->db->prepare(
            'SELECT 1 FROM professional_comments WHERE professional_id = :professional_id AND author_id = :author_id
             AND created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 60 SECOND) LIMIT 1'
        );
        $recent->execute(['professional_id' => $professional['id'], 'author_id' => $auth['id']]);
        if ($recent->fetchColumn()) {
            throw new ApiException(429, 'COMMENT_RATE_LIMIT', 'Aguarde um minuto antes de publicar outro comentário.');
        }
        $publicId = Uuid::v4();
        $this->db->prepare(
            'INSERT INTO professional_comments (public_id, professional_id, author_id, body, status, created_at, updated_at)
             VALUES (:public_id, :professional_id, :author_id, :body, \'published\', UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        )->execute(['public_id' => $publicId, 'professional_id' => $professional['id'], 'author_id' => $auth['id'], 'body' => $comment]);
        return Response::data([
            'id' => $publicId, 'author' => $this->publicName((string) $auth['name']), 'comment' => $comment, 'createdAt' => gmdate('Y-m-d H:i:s'),
        ], 201);
    }

    public function createReview(Request $request, array $params, ?array $auth): Response
    {
        $this->requireVerifiedEmail($auth);
        $this->rateLimiter->check('review:user:' . $auth['id'], 12, 86400);
        $data = Validator::validate($request->body, [
            'rating' => ['required', 'integer', 'min:1', 'max:5'], 'comment' => ['nullable', 'string', 'max:2000'],
        ]);
        $booking = $this->requireRow(
            'SELECT id, professional_id FROM bookings WHERE public_id = :id AND customer_id = :customer_id AND status = \'completed\'',
            ['id' => $params['id'], 'customer_id' => $auth['id']],
            'Reserva concluída não encontrada.'
        );
        $publicId = Uuid::v4();
        $this->db->beginTransaction();
        try {
            $this->db->prepare(
                'INSERT INTO reviews (public_id, booking_id, customer_id, professional_id, rating, comment, status, created_at, updated_at)
                 VALUES (:public_id, :booking_id, :customer_id, :professional_id, :rating, :comment, \'published\', UTC_TIMESTAMP(), UTC_TIMESTAMP())'
            )->execute([
                'public_id' => $publicId, 'booking_id' => $booking['id'], 'customer_id' => $auth['id'],
                'professional_id' => $booking['professional_id'], 'rating' => $data['rating'], 'comment' => $data['comment'] ?? null,
            ]);
            $this->db->prepare(
                'UPDATE professional_profiles p SET
                    p.rating_avg = (SELECT ROUND(AVG(r.rating), 2) FROM reviews r WHERE r.professional_id = p.user_id AND r.status = \'published\'),
                    p.reviews_count = (SELECT COUNT(*) FROM reviews r WHERE r.professional_id = p.user_id AND r.status = \'published\'),
                    p.updated_at = UTC_TIMESTAMP() WHERE p.user_id = :id'
            )->execute(['id' => $booking['professional_id']]);
            $this->notify((int) $booking['professional_id'], 'review.received', 'Nova avaliação', 'Você recebeu uma nova avaliação.', ['reviewId' => $publicId]);
            $this->db->commit();
        } catch (\PDOException $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            if ($exception->getCode() === '23000') {
                throw new ApiException(409, 'REVIEW_ALREADY_EXISTS', 'Esta reserva já foi avaliada.');
            }
            throw $exception;
        }
        return Response::data(['id' => $publicId, 'rating' => (int) $data['rating'], 'comment' => $data['comment'] ?? null], 201);
    }

    public function reportContent(Request $request, array $params, ?array $auth): Response
    {
        $this->requireVerifiedEmail($auth);
        $this->rateLimiter->check('report:user:' . $auth['id'], 12, 86400);
        $data = Validator::validate($request->body, [
            'contentType' => ['required', 'string', 'in:professional_comment,review,message'],
            'contentId' => ['required', 'uuid'],
            'reason' => ['required', 'string', 'min:8', 'max:500'],
        ]);
        $type = (string) $data['contentType'];
        $content = match ($type) {
            'professional_comment' => $this->requireRow('SELECT author_id AS authorId FROM professional_comments WHERE public_id = :id', ['id' => $data['contentId']], 'Comentário não encontrado.'),
            'review' => $this->requireRow('SELECT customer_id AS authorId FROM reviews WHERE public_id = :id', ['id' => $data['contentId']], 'Avaliação não encontrada.'),
            'message' => $this->requireRow(
                'SELECT m.sender_id AS authorId FROM messages m INNER JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id WHERE m.public_id = :id AND cp.user_id = :user_id',
                ['id' => $data['contentId'], 'user_id' => $auth['id']],
                'Mensagem não encontrada.'
            ),
        };
        if ((int) $content['authorId'] === (int) $auth['id']) {
            throw new ApiException(422, 'OWN_CONTENT_REPORT', 'Você não pode denunciar seu próprio conteúdo.');
        }
        try {
            $publicId = Uuid::v4();
            $this->db->prepare('INSERT INTO content_reports (public_id, reporter_id, content_type, content_public_id, reason, status, action, created_at, updated_at) VALUES (:public_id, :reporter_id, :type, :content_id, :reason, \'pending\', \'none\', UTC_TIMESTAMP(), UTC_TIMESTAMP())')
                ->execute(['public_id' => $publicId, 'reporter_id' => $auth['id'], 'type' => $type, 'content_id' => $data['contentId'], 'reason' => trim(strip_tags((string) $data['reason']))]);
        } catch (\PDOException $exception) {
            if ($exception->getCode() === '23000') {
                throw new ApiException(409, 'REPORT_ALREADY_EXISTS', 'Você já denunciou este conteúdo.');
            }
            throw $exception;
        }
        return Response::data(['id' => $publicId, 'status' => 'pending'], 201);
    }

    public function replyToReview(Request $request, array $params, ?array $auth): Response
    {
        $this->requireVerifiedEmail($auth);
        $data = Validator::validate($request->body, ['reply' => ['required', 'string', 'min:3', 'max:2000']]);
        $reply = trim(strip_tags((string) $data['reply']));
        $statement = $this->db->prepare('UPDATE reviews SET provider_reply = :reply, updated_at = UTC_TIMESTAMP() WHERE public_id = :id AND professional_id = :professional_id AND status = \'published\'');
        $statement->execute(['reply' => $reply, 'id' => $params['id'], 'professional_id' => $auth['id']]);
        if ($statement->rowCount() === 0) {
            $this->requireRow('SELECT id FROM reviews WHERE public_id = :id AND professional_id = :professional_id', ['id' => $params['id'], 'professional_id' => $auth['id']], 'Avaliação não encontrada.');
        }
        return Response::data(['id' => $params['id'], 'providerReply' => $reply]);
    }

    private function conversationForUser(string $publicId, int $userId): array
    {
        return $this->requireRow(
            'SELECT c.id, c.kind, b.status AS booking_status FROM conversations c
             INNER JOIN conversation_participants cp ON cp.conversation_id = c.id
             LEFT JOIN bookings b ON b.id = c.booking_id
             WHERE c.public_id = :public_id AND cp.user_id = :user_id',
            ['public_id' => $publicId, 'user_id' => $userId],
            'Conversa não encontrada.'
        );
    }

    private function publicName(string $name): string
    {
        $parts = preg_split('/\s+/u', trim($name)) ?: [];
        if ($parts === []) return 'Membro da comunidade';
        if (count($parts) === 1) return $parts[0];
        return $parts[0] . ' ' . mb_strtoupper(mb_substr((string) end($parts), 0, 1)) . '.';
    }

    private function messageRowsAfter(int $conversationId, int $after, int $limit): array
    {
        $statement = $this->db->prepare(
            "SELECT m.id AS sequence, m.public_id AS id, u.public_id AS senderId, u.name AS senderName,
                    m.body, m.message_type AS messageType, m.created_at AS createdAt
             FROM messages m INNER JOIN users u ON u.id = m.sender_id
             WHERE m.conversation_id = :conversation_id AND m.id > :after
             ORDER BY m.id ASC LIMIT {$limit}"
        );
        $statement->execute(['conversation_id' => $conversationId, 'after' => $after]);
        return $statement->fetchAll();
    }

    private function messageRowsBefore(int $conversationId, int $before, int $limit): array
    {
        $statement = $this->db->prepare(
            "SELECT m.id AS sequence, m.public_id AS id, u.public_id AS senderId, u.name AS senderName,
                    m.body, m.message_type AS messageType, m.created_at AS createdAt
             FROM messages m INNER JOIN users u ON u.id = m.sender_id
             WHERE m.conversation_id = :conversation_id AND m.id < :before
             ORDER BY m.id DESC LIMIT {$limit}"
        );
        $statement->execute(['conversation_id' => $conversationId, 'before' => $before]);
        return array_reverse($statement->fetchAll());
    }

    private function messageByPublicId(string $publicId, int $senderId): array
    {
        return $this->requireRow(
            'SELECT m.id AS sequence, m.public_id AS id, u.public_id AS senderId, u.name AS senderName,
                    m.body, m.message_type AS messageType, m.created_at AS createdAt
             FROM messages m INNER JOIN users u ON u.id = m.sender_id
             WHERE m.public_id = :public_id AND m.sender_id = :sender_id',
            ['public_id' => $publicId, 'sender_id' => $senderId],
            'Mensagem não encontrada.'
        );
    }

    private function publicProfessional(string $publicId): array
    {
        return $this->requireRow(
            'SELECT u.id FROM users u INNER JOIN professional_profiles p ON p.user_id = u.id
             WHERE u.public_id = :id AND u.role = \'provider\' AND u.status = \'active\' AND p.verification_status = \'approved\'',
            ['id' => $publicId], 'Profissional não encontrado.'
        );
    }

    private function avatarUrl(string $publicId, mixed $path, mixed $updatedAt): ?string
    {
        if ($publicId === '' || !is_string($path) || $path === '') {
            return null;
        }
        return '/api/v1/avatars/' . rawurlencode($publicId) . '?v=' . urlencode((string) ($updatedAt ?? '0'));
    }
}
