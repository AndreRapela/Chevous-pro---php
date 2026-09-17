<?php

declare(strict_types=1);

use ChezVoust\Core\Database;
use ChezVoust\Core\Env;
use ChezVoust\Core\HttpClient;
use ChezVoust\Core\SensitivePayload;
use ChezVoust\Modules\Mail\ResendMailer;

require dirname(__DIR__) . '/bootstrap/autoload.php';
Env::load(dirname(__DIR__) . '/.env');
$config = require dirname(__DIR__) . '/config/app.php';
$db = new Database($config['database']);
$pdo = $db->pdo();
$mailer = new ResendMailer($config, new HttpClient());
$sensitivePayload = new SensitivePayload($config['outbox_encryption_key']);
$decodePayload = static function (string $encoded) use ($sensitivePayload): array {
    try {
        return $sensitivePayload->decrypt($encoded);
    } catch (Throwable $exception) {
        // Eventos pendentes criados antes da cifra precisam ser drenados uma
        // única vez. Ao finalizar, o UPDATE de $mark elimina o payload legado.
        $legacy = json_decode($encoded, true);
        if (is_array($legacy) && isset($legacy['email'], $legacy['token']) && is_string($legacy['email']) && is_string($legacy['token'])) {
            error_log('[ChezVoust Pro] Processando evento de e-mail legado para limpeza segura.');
            return $legacy;
        }
        throw $exception;
    }
};

$pdo->beginTransaction();
try {
    $events = $pdo->query(
        'SELECT id, event_type, payload, attempts
         FROM outbox_events WHERE processed_at IS NULL AND available_at <= UTC_TIMESTAMP()
         ORDER BY id LIMIT 50 FOR UPDATE SKIP LOCKED'
    )->fetchAll();
    $claim = $pdo->prepare(
        'UPDATE outbox_events SET attempts = attempts + 1, available_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE)
         WHERE id = :id AND processed_at IS NULL'
    );
    foreach ($events as $event) {
        $claim->execute(['id' => $event['id']]);
    }
    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $exception;
}

$mark = $pdo->prepare("UPDATE outbox_events SET processed_at = UTC_TIMESTAMP(), payload = JSON_OBJECT() WHERE id = :id AND processed_at IS NULL");
$retry = $pdo->prepare('UPDATE outbox_events SET available_at = :available_at WHERE id = :id AND processed_at IS NULL');
foreach ($events as $event) {
    try {
        if (!str_starts_with((string) $event['event_type'], 'email.')) {
            throw new RuntimeException('Tipo de evento não suportado pelo worker.');
        }
        if ($config['mail']['driver'] === 'log') {
            error_log('[ChezVoust Pro] E-mail de desenvolvimento registrado: ' . $event['event_type']);
        } elseif ($config['mail']['driver'] === 'resend') {
            $payload = $decodePayload((string) $event['payload']);
            $mailer->send((string) $event['event_type'], $payload);
        } else {
            throw new RuntimeException('MAIL_DRIVER inválido.');
        }
        $mark->execute(['id' => $event['id']]);
    } catch (Throwable $exception) {
        $delay = min(3600, max(60, 60 * (2 ** min(5, (int) $event['attempts']))));
        $retry->execute([
            'available_at' => gmdate('Y-m-d H:i:s', time() + $delay),
            'id' => $event['id'],
        ]);
        error_log('[ChezVoust Pro] Falha ao processar evento de e-mail ' . (int) $event['id'] . ': ' . $exception->getMessage());
    }
}

// Limpeza fora do caminho de requisições. O índice de expiração mantém essa
// operação previsível e evita picos aleatórios de escrita durante o chat.
$pdo->exec('DELETE FROM api_rate_limits WHERE expires_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) LIMIT 10000');
// Remove tokens de eventos de e-mail que foram processados por versões
// anteriores do worker. Eventos novos já são limpos no mesmo UPDATE de $mark.
$pdo->exec("UPDATE outbox_events SET payload = JSON_OBJECT()\n    WHERE processed_at IS NOT NULL AND event_type LIKE 'email.%' AND JSON_LENGTH(payload) > 0 LIMIT 10000");

fwrite(STDOUT, count($events) . " evento(s) processado(s).\n");
