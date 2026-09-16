UPDATE bookings SET status = 'confirmed' WHERE status = 'awaiting_payment';
UPDATE bookings SET status = 'cancelled' WHERE status = 'refunded';

DROP TABLE IF EXISTS payment_transactions;
DROP TABLE IF EXISTS payment_intents;

ALTER TABLE bookings DROP COLUMN IF EXISTS paid_at;
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
