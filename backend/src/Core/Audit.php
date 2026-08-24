<?php

declare(strict_types=1);

namespace ChezVoust\Core;

use PDO;

final class Audit
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function record(?int $actorId, string $action, string $entityType, ?string $entityId, Request $request, array $metadata = []): void
    {
        $statement = $this->db->prepare(
            'INSERT INTO audit_logs (actor_id, action, entity_type, entity_public_id, ip_address, request_id, metadata, created_at)
             VALUES (:actor, :action, :entity_type, :entity_id, :ip, :request_id, :metadata, UTC_TIMESTAMP())'
        );
        $statement->execute([
            'actor' => $actorId,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'ip' => $request->ip,
            'request_id' => $request->requestId,
            'metadata' => $metadata === [] ? null : json_encode($metadata, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
        ]);
    }
}
