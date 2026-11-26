<?php

declare(strict_types=1);

use ChezVoust\Core\Database;
use ChezVoust\Core\Env;
use ChezVoust\Core\PublicReadLimiter;
use ChezVoust\Core\SensitivePayload;
use ChezVoust\Core\WorkerHealth;
use ChezVoust\Modules\Admin\PromotionUploads;
use ChezVoust\Modules\Mail\MailOutbox;
use ChezVoust\Modules\Store\ProductOrderLifecycle;
use ChezVoust\Modules\Store\StripeCheckout;

require dirname(__DIR__) . '/bootstrap/autoload.php';
Env::load(dirname(__DIR__) . '/.env');
$config = require dirname(__DIR__) . '/config/app.php';
$db = new Database($config['database']);
$pdo = $db->pdo();
$workerHealth = new WorkerHealth($pdo, $config['worker_heartbeat_max_age_seconds']);
if (($argv[1] ?? '') === '--healthcheck') {
    exit($workerHealth->isHealthy() ? 0 : 1);
}

$healthy = true;
try {
    $outbox = new MailOutbox($pdo, $config, new SensitivePayload($config['outbox_encryption_key']));
    $processed = $outbox->process();

    // A manutenção da fila e dos rate limits fica fora das requisições web.
    $pdo->exec('DELETE FROM api_rate_limits WHERE expires_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) LIMIT 10000');
    $pdo->exec("UPDATE outbox_events SET payload = JSON_OBJECT()
        WHERE processed_at IS NOT NULL AND event_type LIKE 'email.%' AND JSON_LENGTH(payload) > 0 LIMIT 10000");
    $pdo->exec('DELETE FROM outbox_events WHERE processed_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY) LIMIT 10000');
    $pdo->exec('DELETE FROM outbox_events WHERE failed_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY) LIMIT 10000');

    fwrite(STDOUT, $processed . " evento(s) processado(s).\n");
} catch (Throwable $failure) {
    $healthy = false;
    error_log('[ChezVoust Pro] Falha ao processar a fila de e-mails ou sua manutenção: ' . $failure::class);
}

try {
    (new ProductOrderLifecycle($pdo, new StripeCheckout($config['store_payment'])))->reconcileDue(3);
} catch (Throwable $failure) {
    $healthy = false;
    error_log('[ChezVoust Pro] Falha ao reconciliar pedidos da loja: ' . $failure::class);
}

try {
    $removed = (new PromotionUploads($pdo, $config['database']['name']))->cleanUp();
    if ($removed > 0) {
        fwrite(STDOUT, $removed . " mídia(s) de campanha sem uso removida(s).\n");
    }
    (new PublicReadLimiter(dirname(__DIR__) . '/storage/rate-limits'))->prune();
} catch (Throwable $failure) {
    $healthy = false;
    error_log('[ChezVoust Pro] Falha na limpeza de arquivos: ' . $failure::class);
}

$workerHealth->record($healthy);
exit($healthy ? 0 : 1);
