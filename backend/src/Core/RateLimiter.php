<?php

declare(strict_types=1);

namespace ChezVoust\Core;

use PDO;

final class RateLimiter
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function check(string $key, int $limit, int $windowSeconds): void
    {
        $windowSeconds = max(1, min($windowSeconds, 86400));
        $limit = max(1, $limit);
        $rateKey = hash('sha256', $key);

        $sql = "INSERT INTO api_rate_limits (rate_key, window_started_at, hits, expires_at)
                VALUES (:rate_key, UTC_TIMESTAMP(), 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL {$windowSeconds} SECOND))
                ON DUPLICATE KEY UPDATE
                    hits = IF(expires_at <= UTC_TIMESTAMP(), 1, hits + 1),
                    window_started_at = IF(expires_at <= UTC_TIMESTAMP(), UTC_TIMESTAMP(), window_started_at),
                    expires_at = IF(expires_at <= UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL {$windowSeconds} SECOND), expires_at)";
        $statement = $this->db->prepare($sql);
        $statement->execute(['rate_key' => $rateKey]);

        $read = $this->db->prepare('SELECT hits, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), expires_at) AS retry_after FROM api_rate_limits WHERE rate_key = :rate_key');
        $read->execute(['rate_key' => $rateKey]);
        $bucket = $read->fetch();
        if ($bucket && (int) $bucket['hits'] > $limit) {
            $retry = max(1, (int) $bucket['retry_after']);
            throw new ApiException(429, 'RATE_LIMITED', "Muitas tentativas. Tente novamente em {$retry} segundos.");
        }

        if (random_int(1, 100) === 1) {
            $this->db->exec('DELETE FROM api_rate_limits WHERE expires_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)');
        }
    }
}
