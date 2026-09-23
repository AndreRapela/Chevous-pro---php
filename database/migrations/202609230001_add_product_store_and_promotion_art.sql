CREATE TABLE IF NOT EXISTS products (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(160) NOT NULL,
    slug VARCHAR(180) NOT NULL,
    short_description VARCHAR(300) NULL,
    price_cents BIGINT UNSIGNED NOT NULL,
    compare_at_price_cents BIGINT UNSIGNED NULL,
    currency CHAR(3) NOT NULL DEFAULT 'BRL',
    image_url VARCHAR(1024) NULL,
    purchase_url VARCHAR(1024) NOT NULL,
    badge_text VARCHAR(80) NULL,
    inventory_count INT UNSIGNED NOT NULL DEFAULT 0,
    featured TINYINT(1) NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_products_public_id (public_id),
    UNIQUE KEY uq_products_slug (slug),
    KEY idx_products_public_catalog (active, sort_order, featured, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_promotion_image = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'promotions' AND column_name = 'image_url'
);
SET @add_promotion_image = IF(
    @has_promotion_image = 0,
    'ALTER TABLE promotions ADD COLUMN image_url VARCHAR(1024) NULL AFTER cta_url',
    'SELECT 1'
);
PREPARE add_promotion_image_statement FROM @add_promotion_image;
EXECUTE add_promotion_image_statement;
DEALLOCATE PREPARE add_promotion_image_statement;

SET @has_promotion_badge = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'promotions' AND column_name = 'badge_text'
);
SET @add_promotion_badge = IF(
    @has_promotion_badge = 0,
    'ALTER TABLE promotions ADD COLUMN badge_text VARCHAR(80) NULL AFTER image_url',
    'SELECT 1'
);
PREPARE add_promotion_badge_statement FROM @add_promotion_badge;
EXECUTE add_promotion_badge_statement;
DEALLOCATE PREPARE add_promotion_badge_statement;

SET @has_promotion_terms = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'promotions' AND column_name = 'terms_text'
);
SET @add_promotion_terms = IF(
    @has_promotion_terms = 0,
    'ALTER TABLE promotions ADD COLUMN terms_text VARCHAR(300) NULL AFTER badge_text',
    'SELECT 1'
);
PREPARE add_promotion_terms_statement FROM @add_promotion_terms;
EXECUTE add_promotion_terms_statement;
DEALLOCATE PREPARE add_promotion_terms_statement;

UPDATE promotions
SET cta_label = 'Conhecer a loja',
    cta_url = '/produtos',
    image_url = COALESCE(image_url, '/images/promo-laundry-discount-v1.webp'),
    badge_text = COALESCE(badge_text, 'Novidades na loja'),
    terms_text = COALESCE(terms_text, 'Preços e disponibilidade podem mudar sem aviso prévio.'),
    updated_at = UTC_TIMESTAMP()
WHERE sort_order = (SELECT selected.sort_order FROM (SELECT MIN(sort_order) AS sort_order FROM promotions) selected);
