<?php

declare(strict_types=1);

use ChezVoust\Core\Database;
use ChezVoust\Core\Env;

require dirname(__DIR__) . '/bootstrap/autoload.php';
Env::load(dirname(__DIR__) . '/.env');
$config = require dirname(__DIR__) . '/config/app.php';
$db = new Database($config['database']);
$pdo = $db->pdo();

$pdo->beginTransaction();
try {
    $events = $pdo->query(
        'SELECT id, event_type, aggregate_type, aggregate_id
         FROM outbox_events WHERE processed_at IS NULL AND available_at <= UTC_TIMESTAMP()
         ORDER BY id LIMIT 50 FOR UPDATE SKIP LOCKED'
    )->fetchAll();
    $mark = $pdo->prepare('UPDATE outbox_events SET processed_at = UTC_TIMESTAMP(), attempts = attempts + 1 WHERE id = :id');
    foreach ($events as $event) {
        if (str_starts_with($event['event_type'], 'email.')) {
            if ($config['mail_driver'] !== 'log') {
                throw new RuntimeException('MAIL_DRIVER não possui adaptador implementado; evento mantido na outbox.');
            }
            error_log(sprintf(
                '[ChezVoust Pro mail demo] evento=%s agregado=%s:%s',
                $event['event_type'],
                $event['aggregate_type'],
                $event['aggregate_id'] ?? 'n/a'
            ));
        }
        $mark->execute(['id' => $event['id']]);
    }
    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $exception;
}

$pdo->beginTransaction();
try {
    $expired = $pdo->query(
        "SELECT b.id FROM slot_reservations sr
         INNER JOIN bookings b ON b.id = sr.booking_id
         WHERE sr.status = 'held' AND sr.expires_at <= UTC_TIMESTAMP() AND b.status = 'awaiting_payment'
         ORDER BY sr.expires_at, b.id LIMIT 100 FOR UPDATE SKIP LOCKED"
    )->fetchAll();
    $cancelBooking = $pdo->prepare(
        "UPDATE bookings SET status = 'cancelled', cancellation_reason = 'Reserva de pagamento expirada',
            cancelled_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
         WHERE id = :id AND status = 'awaiting_payment'"
    );
    $releaseSlot = $pdo->prepare(
        "UPDATE slot_reservations SET status = 'released', released_at = UTC_TIMESTAMP()
         WHERE booking_id = :id AND status = 'held'"
    );
    $cancelIntents = $pdo->prepare(
        "UPDATE payment_intents SET status = 'cancelled', failure_code = COALESCE(failure_code, 'payment_window_expired'),
            updated_at = UTC_TIMESTAMP() WHERE booking_id = :id AND status = 'pending'"
    );
    $history = $pdo->prepare(
        "INSERT INTO booking_status_history (booking_id, from_status, to_status, actor_id, reason, created_at)
         VALUES (:id, 'awaiting_payment', 'cancelled', NULL, 'Reserva de pagamento expirada', UTC_TIMESTAMP())"
    );
    foreach ($expired as $row) {
        $bookingId = (int) $row['id'];
        $cancelBooking->execute(['id' => $bookingId]);
        if ($cancelBooking->rowCount() !== 1) {
            continue;
        }
        $releaseSlot->execute(['id' => $bookingId]);
        $cancelIntents->execute(['id' => $bookingId]);
        $history->execute(['id' => $bookingId]);
    }
    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $exception;
}

fwrite(STDOUT, count($events) . " evento(s) processado(s).\n");
