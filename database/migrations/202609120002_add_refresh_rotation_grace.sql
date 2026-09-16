-- Duas abas podem renovar o mesmo cookie praticamente no mesmo instante. A
-- janela curta preserva a sessão legítima já rotacionada, sem aceitar o token
-- anterior fora desse intervalo e sem substituir o cookie mais novo.
SET @has_previous_hash := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'auth_sessions' AND column_name = 'previous_refresh_token_hash'
);
SET @previous_hash_sql := IF(
    @has_previous_hash = 0,
    'ALTER TABLE auth_sessions ADD COLUMN previous_refresh_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER refresh_token_hash',
    'SELECT 1'
);
PREPARE refresh_rotation_statement FROM @previous_hash_sql;
EXECUTE refresh_rotation_statement;
DEALLOCATE PREPARE refresh_rotation_statement;

SET @has_previous_expiry := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'auth_sessions' AND column_name = 'previous_refresh_expires_at'
);
SET @previous_expiry_sql := IF(
    @has_previous_expiry = 0,
    'ALTER TABLE auth_sessions ADD COLUMN previous_refresh_expires_at DATETIME NULL AFTER previous_refresh_token_hash',
    'SELECT 1'
);
PREPARE refresh_rotation_statement FROM @previous_expiry_sql;
EXECUTE refresh_rotation_statement;
DEALLOCATE PREPARE refresh_rotation_statement;
