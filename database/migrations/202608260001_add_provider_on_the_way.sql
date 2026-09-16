ALTER TABLE bookings
    MODIFY COLUMN status ENUM(
        'draft',
        'open',
        'awaiting_payment',
        'confirmed',
        'provider_on_the_way',
        'in_progress',
        'completed',
        'cancelled',
        'refunded',
        'disputed'
    ) NOT NULL;
