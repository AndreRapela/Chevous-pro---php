SET @has_failed_at := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'outbox_events' AND column_name = 'failed_at'
);
SET @outbox_sql := IF(
    @has_failed_at = 0,
    'ALTER TABLE outbox_events ADD COLUMN failed_at DATETIME NULL AFTER processed_at',
    'SELECT 1'
);
PREPARE outbox_statement FROM @outbox_sql;
EXECUTE outbox_statement;
DEALLOCATE PREPARE outbox_statement;

SET @has_last_error := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'outbox_events' AND column_name = 'last_error'
);
SET @outbox_sql := IF(
    @has_last_error = 0,
    'ALTER TABLE outbox_events ADD COLUMN last_error VARCHAR(500) NULL AFTER failed_at',
    'SELECT 1'
);
PREPARE outbox_statement FROM @outbox_sql;
EXECUTE outbox_statement;
DEALLOCATE PREPARE outbox_statement;

SET @has_pending_index := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'outbox_events' AND index_name = 'idx_outbox_pending'
);
SET @outbox_sql := IF(
    @has_pending_index > 0,
    'ALTER TABLE outbox_events DROP INDEX idx_outbox_pending, ADD INDEX idx_outbox_pending (processed_at, failed_at, available_at, id)',
    'ALTER TABLE outbox_events ADD INDEX idx_outbox_pending (processed_at, failed_at, available_at, id)'
);
PREPARE outbox_statement FROM @outbox_sql;
EXECUTE outbox_statement;
DEALLOCATE PREPARE outbox_statement;
