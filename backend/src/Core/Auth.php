<?php

declare(strict_types=1);

namespace ChezVoust\Core;

use PDO;

final class Auth
{
    public function __construct(
        private readonly PDO $db,
        private readonly Jwt $jwt
    ) {
    }

    public function requireUser(Request $request, array $roles = []): array
    {
        $token = $request->bearerToken();
        if ($token === null) {
            throw new ApiException(401, 'AUTHENTICATION_REQUIRED', 'Faça login para continuar.');
        }

        $claims = $this->jwt->decode($token, 'access');
        $subject = (string) ($claims['sub'] ?? '');
        $sessionId = (string) ($claims['sid'] ?? '');
        if ($subject === '' || $sessionId === '') {
            throw new ApiException(401, 'INVALID_TOKEN', 'Token de autenticação inválido.');
        }

        $statement = $this->db->prepare(
            'SELECT u.id, u.public_id AS publicId, u.name, u.email, u.phone, u.role, u.status,
                    s.public_id AS sessionId
             FROM users u
             INNER JOIN auth_sessions s ON s.user_id = u.id
             WHERE u.public_id = :subject
               AND s.public_id = :session
               AND s.revoked_at IS NULL
               AND s.expires_at > UTC_TIMESTAMP()
             LIMIT 1'
        );
        $statement->execute(['subject' => $subject, 'session' => $sessionId]);
        $user = $statement->fetch();

        if (!$user || $user['status'] !== 'active') {
            throw new ApiException(401, 'SESSION_EXPIRED', 'Sua sessão não está mais ativa.');
        }

        if ($roles !== [] && !in_array($user['role'], $roles, true)) {
            throw new ApiException(403, 'FORBIDDEN', 'Você não possui permissão para esta ação.');
        }

        return $user;
    }
}
