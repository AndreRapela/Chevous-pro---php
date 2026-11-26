SET @add_promotion_media_frame = IF(
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'promotions' AND column_name = 'media_frame'
    ),
    'SELECT 1',
    'ALTER TABLE promotions ADD COLUMN media_frame JSON NULL AFTER media_type'
);
PREPARE add_promotion_media_frame_statement FROM @add_promotion_media_frame;
EXECUTE add_promotion_media_frame_statement;
DEALLOCATE PREPARE add_promotion_media_frame_statement;
