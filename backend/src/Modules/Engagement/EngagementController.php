<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Engagement;

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Controller;
use ChezVoust\Core\Request;
use ChezVoust\Core\Response;
use ChezVoust\Core\Uuid;
use ChezVoust\Core\Validator;

final class EngagementController extends Controller
{
    public function conversations(Request $request, array $params, ?array $auth): Response
    {
        $statement = $this->db->prepare(
            'SELECT c.public_id AS id, b.public_id AS bookingId, b.status AS bookingStatus,
                    s.name AS serviceName, c.updated_at AS updatedAt,
                    (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS lastMessage,
                    (SELECT COUNT(*) FROM messages m
                     WHERE m.conversation_id = c.id AND m.id > COALESCE(cp.last_read_message_id, 0) AND m.sender_id <> :sender_id) AS unreadCount
             FROM conversation_participants cp INNER JOIN conversations c ON c.id = cp.conversation_id
             INNER JOIN bookings b ON b.id = c.booking_id INNER JOIN services s ON s.id = b.service_id
             WHERE cp.user_id = :user_id ORDER BY c.updated_at DESC'
        );
        $statement->execute(['sender_id' => $auth['id'], 'user_id' => $auth['id']]);
        return Response::data($statement->fetchAll());
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
        $limit = max(1, min(100, (int) ($request->query['limit'] ?? 50)));
        $statement = $this->db->prepare(
            "SELECT m.id AS sequence, m.public_id AS id, u.public_id AS senderId, u.name AS senderName,
                    m.body, m.message_type AS messageType, m.created_at AS createdAt
             FROM messages m INNER JOIN users u ON u.id = m.sender_id
             WHERE m.conversation_id = :conversation_id AND m.id > :after
             ORDER BY m.id ASC LIMIT {$limit}"
        );
        $statement->execute(['conversation_id' => $conversation['id'], 'after' => $after]);
        return Response::data($statement->fetchAll(), 200, ['after' => $after, 'limit' => $limit]);
    }

    public function sendMessage(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, ['body' => ['required', 'string', 'min:1', 'max:4000']]);
        $body = trim(strip_tags((string) $data['body']));
        if ($body === '') {
            throw new ApiException(422, 'EMPTY_MESSAGE', 'A mensagem não pode ficar vazia.');
        }
        $conversation = $this->conversationForUser($params['id'], (int) $auth['id']);
        if (!in_array($conversation['booking_status'], ['awaiting_payment', 'confirmed', 'in_progress', 'completed', 'disputed'], true)) {
            throw new ApiException(409, 'CHAT_UNAVAILABLE', 'O chat não está disponível para esta reserva.');
        }
        $publicId = Uuid::v4();
        $this->db->prepare(
            'INSERT INTO messages (public_id, conversation_id, sender_id, message_type, body, created_at)
             VALUES (:public_id, :conversation_id, :sender_id, \'text\', :body, UTC_TIMESTAMP())'
        )->execute(['public_id' => $publicId, 'conversation_id' => $conversation['id'], 'sender_id' => $auth['id'], 'body' => $body]);
        $sequence = (int) $this->db->lastInsertId();
        $this->db->prepare('UPDATE conversations SET updated_at = UTC_TIMESTAMP() WHERE id = :id')->execute(['id' => $conversation['id']]);
        $recipients = $this->db->prepare('SELECT user_id FROM conversation_participants WHERE conversation_id = :id AND user_id <> :sender');
        $recipients->execute(['id' => $conversation['id'], 'sender' => $auth['id']]);
        foreach ($recipients->fetchAll() as $recipient) {
            $this->notify((int) $recipient['user_id'], 'chat.message', 'Nova mensagem', $auth['name'] . ' enviou uma mensagem.', ['conversationId' => $params['id']]);
        }
        return Response::data([
            'sequence' => $sequence,
            'id' => $publicId,
            'senderId' => $auth['publicId'],
            'senderName' => $auth['name'],
            'body' => $body,
            'messageType' => 'text',
            'createdAt' => gmdate('Y-m-d H:i:s'),
        ], 201);
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
        return Response::data($statement->fetchAll(), 200, ['page' => $page, 'perPage' => $perPage, 'total' => $total, 'lastPage' => max(1, (int) ceil($total / $perPage))]);
    }

    public function createReview(Request $request, array $params, ?array $auth): Response
    {
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

    private function conversationForUser(string $publicId, int $userId): array
    {
        return $this->requireRow(
            'SELECT c.id, b.status AS booking_status FROM conversations c
             INNER JOIN conversation_participants cp ON cp.conversation_id = c.id
             INNER JOIN bookings b ON b.id = c.booking_id
             WHERE c.public_id = :public_id AND cp.user_id = :user_id',
            ['public_id' => $publicId, 'user_id' => $userId],
            'Conversa não encontrada.'
        );
    }
}
