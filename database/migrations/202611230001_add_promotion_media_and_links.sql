SET @has_promotion_media_type = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'promotions' AND column_name = 'media_type'
);
SET @add_promotion_media_type = IF(
    @has_promotion_media_type = 0,
    'ALTER TABLE promotions ADD COLUMN media_type VARCHAR(10) NOT NULL DEFAULT ''image'' AFTER image_url',
    'SELECT 1'
);
PREPARE add_promotion_media_type_statement FROM @add_promotion_media_type;
EXECUTE add_promotion_media_type_statement;
DEALLOCATE PREPARE add_promotion_media_type_statement;

SET @has_promotion_button_placement = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'promotions' AND column_name = 'button_placement'
);
SET @add_promotion_button_placement = IF(
    @has_promotion_button_placement = 0,
    'ALTER TABLE promotions ADD COLUMN button_placement VARCHAR(20) NOT NULL DEFAULT ''banner'' AFTER media_type',
    'SELECT 1'
);
PREPARE add_promotion_button_placement_statement FROM @add_promotion_button_placement;
EXECUTE add_promotion_button_placement_statement;
DEALLOCATE PREPARE add_promotion_button_placement_statement;

SET @has_promotion_secondary_links = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'promotions' AND column_name = 'secondary_links'
);
SET @add_promotion_secondary_links = IF(
    @has_promotion_secondary_links = 0,
    'ALTER TABLE promotions ADD COLUMN secondary_links JSON NULL AFTER button_placement',
    'SELECT 1'
);
PREPARE add_promotion_secondary_links_statement FROM @add_promotion_secondary_links;
EXECUTE add_promotion_secondary_links_statement;
DEALLOCATE PREPARE add_promotion_secondary_links_statement;
