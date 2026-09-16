-- A plataforma não processa pagamentos nem aplica descontos. Preserve um
-- backup antes de executar: registros de cupons deixam de fazer parte do
-- produto e são removidos junto das tabelas auxiliares. Os blocos condicionais
-- tornam a migração segura também em bancos novos, já inicializados sem cupom.
SET @has_coupon_column := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = 'coupon_id'
);
SET @coupon_sql := IF(@has_coupon_column > 0, 'UPDATE bookings SET coupon_id = NULL WHERE coupon_id IS NOT NULL', 'SELECT 1');
PREPARE coupon_statement FROM @coupon_sql;
EXECUTE coupon_statement;
DEALLOCATE PREPARE coupon_statement;

DROP TABLE IF EXISTS coupon_redemptions;
DROP TABLE IF EXISTS coupon_services;

SET @has_coupon_fk := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE() AND table_name = 'bookings' AND constraint_name = 'fk_bookings_coupon'
);
SET @coupon_sql := IF(@has_coupon_fk > 0, 'ALTER TABLE bookings DROP FOREIGN KEY fk_bookings_coupon', 'SELECT 1');
PREPARE coupon_statement FROM @coupon_sql;
EXECUTE coupon_statement;
DEALLOCATE PREPARE coupon_statement;

SET @has_coupon_index := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'bookings' AND index_name = 'idx_bookings_coupon'
);
SET @coupon_sql := IF(@has_coupon_index > 0, 'ALTER TABLE bookings DROP INDEX idx_bookings_coupon', 'SELECT 1');
PREPARE coupon_statement FROM @coupon_sql;
EXECUTE coupon_statement;
DEALLOCATE PREPARE coupon_statement;

SET @coupon_sql := IF(@has_coupon_column > 0, 'ALTER TABLE bookings DROP COLUMN coupon_id', 'SELECT 1');
PREPARE coupon_statement FROM @coupon_sql;
EXECUTE coupon_statement;
DEALLOCATE PREPARE coupon_statement;

DROP TABLE IF EXISTS coupons;
DELETE FROM app_settings WHERE setting_key IN ('service_fee_percent', 'professional_commission_percent');
