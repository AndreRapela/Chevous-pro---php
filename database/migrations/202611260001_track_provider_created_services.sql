SET @service_origin_sql = IF(
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'services' AND column_name = 'provider_created'
    ),
    'SELECT 1',
    'ALTER TABLE services ADD COLUMN provider_created TINYINT(1) NOT NULL DEFAULT 0'
);
PREPARE service_origin_stmt FROM @service_origin_sql;
EXECUTE service_origin_stmt;
DEALLOCATE PREPARE service_origin_stmt;

-- The original provider form always selected Outros and wrote sort order 999.
-- The admin create and update endpoints never set the service sort order.
UPDATE services s
INNER JOIN service_categories c ON c.id = s.category_id
SET s.provider_created = 1
WHERE c.slug = 'outros' AND s.sort_order = 999 AND s.provider_created = 0;
