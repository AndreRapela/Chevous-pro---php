<?php

declare(strict_types=1);

namespace ChezVoust\Core;

use PDO;

abstract class Controller
{
    public function __construct(
        protected readonly PDO $db,
        protected readonly array $config
    ) {
    }

    protected function pagination(Request $request, int $defaultPerPage = 20, int $maxPerPage = 100): array
    {
        $page = max(1, (int) ($request->query['page'] ?? 1));
        $perPage = max(1, min($maxPerPage, (int) ($request->query['perPage'] ?? $defaultPerPage)));
        return [$page, $perPage, ($page - 1) * $perPage];
    }

    protected function requireRow(string $sql, array $params, string $message = 'Registro não encontrado.'): array
    {
        $statement = $this->db->prepare($sql);
        $statement->execute($params);
        $row = $statement->fetch();
        if (!$row) {
            throw new ApiException(404, 'NOT_FOUND', $message);
        }
        return $row;
    }

    protected function notify(int $userId, string $type, string $title, string $message, array $data = []): void
    {
        $statement = $this->db->prepare(
            'INSERT INTO notifications (public_id, user_id, type, title, message, data, created_at)
             VALUES (:public_id, :user_id, :type, :title, :message, :data, UTC_TIMESTAMP())'
        );
        $statement->execute([
            'public_id' => Uuid::v4(),
            'user_id' => $userId,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'data' => $data === [] ? null : json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
        ]);
    }

    protected function requireVerifiedEmail(?array $auth): void
    {
        if (!$auth || empty($auth['emailVerified'])) {
            throw new ApiException(403, 'EMAIL_VERIFICATION_REQUIRED', 'Confirme seu e-mail para realizar esta ação.');
        }
    }
}
