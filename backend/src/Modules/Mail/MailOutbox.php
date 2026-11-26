<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Mail;

use ChezVoust\Core\HttpClient;
use ChezVoust\Core\SensitivePayload;
use PDO;
use RuntimeException;
use Throwable;

final class MailOutbox
{
    private ?int $queuedEventId = null;

    public function __construct(
        private readonly PDO $db,
        private readonly array $config,
        private readonly SensitivePayload $sensitivePayload,
        private readonly string $cacheDirectory = __DIR__ . '/../../../storage/cache',
    ) {
    }

    public function enqueue(string $eventType, string $userPublicId, string $email, string $token, ?string $locale = null, ?string $code = null): int
    {
        $statement = $this->db->prepare(
            'INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload, available_at, created_at)
             VALUES (:event_type, \'user\', :aggregate_id, :payload, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        );
        $statement->execute([
            'event_type' => $eventType,
            'aggregate_id' => $userPublicId,
            'payload' => $this->sensitivePayload->encrypt(['email' => $email, 'token' => $token, 'locale' => $locale, 'code' => $code]),
        ]);
        return $this->queuedEventId = (int) $this->db->lastInsertId();
    }

    public function scheduleHostedDelivery(): void
    {
        if ($this->config['mail']['driver'] !== 'php-mail') {
            return;
        }
        register_shutdown_function(function (): void {
            try {
                $this->deliverHosted();
            } catch (Throwable $failure) {
                error_log('[ChezVoust Pro] Falha ao consultar a fila de e-mail: ' . $failure::class);
            }
        });
    }

    private function deliverHosted(): void
    {
        if (!is_dir($this->cacheDirectory)) {
            @mkdir($this->cacheDirectory, 0750, true);
        }
        $gate = @fopen($this->cacheDirectory . '/hosted-mail.lock', 'c+');
        if ($gate === false) {
            // Preserve immediate delivery if the shared cache is unavailable.
            if ($this->queuedEventId !== null) {
                $this->finishResponse();
                $this->process($this->queuedEventId);
            }
            return;
        }
        try {
            if (!flock($gate, LOCK_EX | LOCK_NB)) {
                return;
            }
            $now = time();
            $backlogDue = (int) fgets($gate, 32) + 30 <= $now;
            if (!$backlogDue && $this->queuedEventId === null) {
                return;
            }
            $this->finishResponse();
            if ($this->queuedEventId !== null) {
                $this->process($this->queuedEventId);
            }
            if ($backlogDue) {
                rewind($gate);
                fwrite($gate, $now . "\n");
                fflush($gate);
                $this->process(limit: 2);
            }
        } finally {
            fclose($gate);
        }
    }

    private function finishResponse(): void
    {
        ignore_user_abort(true);
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        }
    }

    public function process(?int $eventId = null, int $limit = 50): int
    {
        $events = $this->claim($eventId, max(1, min($limit, 50)));
        if ($events === []) {
            return 0;
        }

        $mailer = new TransactionalMailer($this->config, new HttpClient());
        $mark = $this->db->prepare("UPDATE outbox_events SET processed_at = UTC_TIMESTAMP(), last_error = NULL, payload = JSON_OBJECT() WHERE id = :id AND processed_at IS NULL AND failed_at IS NULL");
        foreach ($events as $event) {
            try {
                if (!str_starts_with((string) $event['event_type'], 'email.')) {
                    throw new RuntimeException('Tipo de evento não suportado pelo worker.');
                }
                if ($this->config['mail']['driver'] === 'log') {
                    error_log('[ChezVoust Pro] E-mail de desenvolvimento registrado: ' . $event['event_type']);
                } elseif (in_array($this->config['mail']['driver'], ['resend', 'php-mail', 'smtp'], true)) {
                    $payload = $this->decodePayload((string) $event['payload']);
                    if ($this->tokenCanBeDelivered($event['event_type'], $payload)) {
                        $mailer->send($event['event_type'], $payload);
                    }
                } else {
                    throw new RuntimeException('MAIL_DRIVER inválido.');
                }
                $mark->execute(['id' => $event['id']]);
            } catch (Throwable $exception) {
                $this->recordFailure($event, $exception);
            }
        }
        return count($events);
    }

    private function tokenCanBeDelivered(string $eventType, array $payload): bool
    {
        $values = [
            'hash' => hash('sha256', (string) ($payload['token'] ?? '')),
            'email' => (string) ($payload['email'] ?? ''),
        ];
        if ($eventType === 'email.change') {
            $statement = $this->db->prepare(
                "SELECT 1 FROM account_email_changes t INNER JOIN users u ON u.id = t.user_id
                 WHERE t.token_hash = :hash AND t.email = :email AND t.expires_at > UTC_TIMESTAMP()
                   AND t.password_digest = SHA2(u.password_hash, 256) AND u.status = 'active' AND u.deleted_at IS NULL"
            );
            $statement->execute($values);
            return $statement->fetchColumn() !== false;
        }

        $table = match ($eventType) {
            'email.verify' => 'email_verification_tokens',
            'email.password_reset' => 'password_reset_tokens',
            default => throw new RuntimeException('Tipo de evento não suportado pelo worker.'),
        };
        $statement = $this->db->prepare(
            "SELECT 1 FROM {$table} t INNER JOIN users u ON u.id = t.user_id
             WHERE t.token_hash = :hash AND t.used_at IS NULL AND t.expires_at > UTC_TIMESTAMP()
             AND u.email = :email AND u.status = 'active' AND u.deleted_at IS NULL"
        );
        $statement->execute($values);
        return $statement->fetchColumn() !== false;
    }

    private function claim(?int $eventId, int $limit): array
    {
        $this->db->beginTransaction();
        try {
            $sql = 'SELECT id, event_type, payload, attempts FROM outbox_events
                    WHERE processed_at IS NULL AND failed_at IS NULL AND available_at <= UTC_TIMESTAMP()';
            $statement = $this->db->prepare($eventId === null
                ? $sql . " ORDER BY id LIMIT {$limit} FOR UPDATE SKIP LOCKED"
                : $sql . ' AND id = :id FOR UPDATE SKIP LOCKED');
            $statement->execute($eventId === null ? [] : ['id' => $eventId]);
            $events = $statement->fetchAll();
            $claim = $this->db->prepare(
                'UPDATE outbox_events SET attempts = attempts + 1, available_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE)
                 WHERE id = :id AND processed_at IS NULL'
            );
            foreach ($events as $event) {
                $claim->execute(['id' => $event['id']]);
            }
            $this->db->commit();
            return $events;
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    private function decodePayload(string $encoded): array
    {
        try {
            return $this->sensitivePayload->decrypt($encoded);
        } catch (Throwable $exception) {
            // Eventos anteriores à cifra continuam elegíveis até que sejam processados.
            $legacy = json_decode($encoded, true);
            if (is_array($legacy) && isset($legacy['email'], $legacy['token']) && is_string($legacy['email']) && is_string($legacy['token'])) {
                error_log('[ChezVoust Pro] Processando evento de e-mail legado para limpeza segura.');
                return $legacy;
            }
            throw $exception;
        }
    }

    private function recordFailure(array $event, Throwable $exception): void
    {
        $attempt = (int) $event['attempts'] + 1;
        $error = mb_substr(preg_replace('/[\r\n]+/', ' ', $exception->getMessage()) ?: 'Falha desconhecida.', 0, 500);
        if ($attempt >= 8) {
            $this->db->prepare("UPDATE outbox_events SET failed_at = UTC_TIMESTAMP(), last_error = :last_error, payload = JSON_OBJECT() WHERE id = :id AND processed_at IS NULL AND failed_at IS NULL")
                ->execute(['last_error' => $error, 'id' => $event['id']]);
            error_log('[ChezVoust Pro] Evento ' . (int) $event['id'] . ' movido para descarte após ' . $attempt . ' tentativas: ' . $error);
            return;
        }

        $delay = min(3600, 60 * (2 ** min(5, $attempt - 1)));
        $this->db->prepare('UPDATE outbox_events SET available_at = :available_at, last_error = :last_error WHERE id = :id AND processed_at IS NULL AND failed_at IS NULL')->execute([
            'available_at' => gmdate('Y-m-d H:i:s', time() + $delay),
            'last_error' => $error,
            'id' => $event['id'],
        ]);
        error_log('[ChezVoust Pro] Falha ao processar evento ' . (int) $event['id'] . ' (tentativa ' . $attempt . '): ' . $error);
    }
}
