<?php

declare(strict_types=1);

namespace ChezVoust\Core;

use PDO;

final class WorkerHealth
{
    private const SETTING_KEY = 'worker_heartbeat';

    public function __construct(private readonly PDO $db, private readonly int $maxAgeSeconds)
    {
    }

    public function record(bool $healthy): void
    {
        $statement = $this->db->prepare(
            "INSERT INTO app_settings (setting_key, setting_value, is_public, updated_at)
             VALUES (:key, JSON_OBJECT('status', :status), 0, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE setting_value = JSON_OBJECT('status', :updatedStatus), is_public = 0, updated_at = UTC_TIMESTAMP()"
        );
        $status = $healthy ? 'ok' : 'failed';
        $statement->execute(['key' => self::SETTING_KEY, 'status' => $status, 'updatedStatus' => $status]);
    }

    public function isHealthy(): bool
    {
        $statement = $this->db->prepare(
            "SELECT JSON_UNQUOTE(JSON_EXTRACT(setting_value, '$.status')) AS status,
                    TIMESTAMPDIFF(SECOND, updated_at, UTC_TIMESTAMP()) AS age_seconds
             FROM app_settings WHERE setting_key = :key"
        );
        $statement->execute(['key' => self::SETTING_KEY]);
        $heartbeat = $statement->fetch();
        return $heartbeat !== false && $heartbeat['status'] === 'ok'
            && (int) $heartbeat['age_seconds'] >= 0 && (int) $heartbeat['age_seconds'] <= $this->maxAgeSeconds;
    }
}
