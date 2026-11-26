SET @add_promotion_video_duration_ms = IF(
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'promotions' AND column_name = 'video_duration_ms'
    ),
    'SELECT 1',
    'ALTER TABLE promotions ADD COLUMN video_duration_ms INT UNSIGNED NULL'
);
PREPARE add_promotion_column FROM @add_promotion_video_duration_ms;
EXECUTE add_promotion_column;
DEALLOCATE PREPARE add_promotion_column;

SET @add_promotion_rotation_weight = IF(
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'promotions' AND column_name = 'rotation_weight'
    ),
    'SELECT 1',
    'ALTER TABLE promotions ADD COLUMN rotation_weight TINYINT UNSIGNED NOT NULL DEFAULT 3'
);
PREPARE add_promotion_column FROM @add_promotion_rotation_weight;
EXECUTE add_promotion_column;
DEALLOCATE PREPARE add_promotion_column;
