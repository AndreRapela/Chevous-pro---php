ALTER TABLE conversations MODIFY booking_id BIGINT UNSIGNED NULL;

SET @has_conversation_kind := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'conversations' AND column_name = 'kind'
);
SET @conversation_sql := IF(
    @has_conversation_kind = 0,
    'ALTER TABLE conversations ADD COLUMN kind ENUM(''booking'', ''inquiry'') NOT NULL DEFAULT ''booking'' AFTER booking_id',
    'SELECT 1'
);
PREPARE conversation_statement FROM @conversation_sql;
EXECUTE conversation_statement;
DEALLOCATE PREPARE conversation_statement;

SET @has_contact_key := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'conversations' AND column_name = 'contact_key'
);
SET @conversation_sql := IF(
    @has_contact_key = 0,
    'ALTER TABLE conversations ADD COLUMN contact_key VARCHAR(80) NULL AFTER kind',
    'SELECT 1'
);
PREPARE conversation_statement FROM @conversation_sql;
EXECUTE conversation_statement;
DEALLOCATE PREPARE conversation_statement;

SET @has_contact_key_index := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'conversations' AND index_name = 'uq_conversations_contact_key'
);
SET @conversation_sql := IF(@has_contact_key_index = 0, 'ALTER TABLE conversations ADD UNIQUE INDEX uq_conversations_contact_key (contact_key)', 'SELECT 1');
PREPARE conversation_statement FROM @conversation_sql;
EXECUTE conversation_statement;
DEALLOCATE PREPARE conversation_statement;

SET @has_kind_updated_index := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'conversations' AND index_name = 'idx_conversations_kind_updated'
);
SET @conversation_sql := IF(@has_kind_updated_index = 0, 'ALTER TABLE conversations ADD INDEX idx_conversations_kind_updated (kind, updated_at)', 'SELECT 1');
PREPARE conversation_statement FROM @conversation_sql;
EXECUTE conversation_statement;
DEALLOCATE PREPARE conversation_statement;
