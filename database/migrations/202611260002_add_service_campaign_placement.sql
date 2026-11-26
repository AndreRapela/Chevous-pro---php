SET @promotion_placement_sql = IF(
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'promotions' AND column_name = 'placement'
    ),
    'SELECT 1',
    'ALTER TABLE promotions
        ADD COLUMN placement ENUM(''home'', ''services'') NOT NULL DEFAULT ''home'',
        ADD COLUMN service_public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
        ADD INDEX idx_promotions_placement (placement, active, service_public_id),
        ADD CONSTRAINT fk_promotions_service FOREIGN KEY (service_public_id) REFERENCES services (public_id)'
);
PREPARE promotion_placement_stmt FROM @promotion_placement_sql;
EXECUTE promotion_placement_stmt;
DEALLOCATE PREPARE promotion_placement_stmt;
