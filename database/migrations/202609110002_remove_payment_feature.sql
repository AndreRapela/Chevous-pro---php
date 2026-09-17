UPDATE bookings SET status = 'confirmed' WHERE status = 'awaiting_payment';
UPDATE bookings SET status = 'cancelled' WHERE status = 'refunded';

DROP TABLE IF EXISTS payment_transactions;
DROP TABLE IF EXISTS payment_intents;

SET @has_paid_at := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = 'paid_at'
);
SET @payment_cleanup_sql := IF(@has_paid_at > 0, 'ALTER TABLE bookings DROP COLUMN paid_at', 'SELECT 1');
PREPARE payment_cleanup_statement FROM @payment_cleanup_sql;
EXECUTE payment_cleanup_statement;
DEALLOCATE PREPARE payment_cleanup_statement;

ALTER TABLE bookings
    MODIFY COLUMN status ENUM(
        'draft',
        'open',
        'confirmed',
        'provider_on_the_way',
        'in_progress',
        'completed',
        'cancelled',
        'disputed'
    ) NOT NULL;
