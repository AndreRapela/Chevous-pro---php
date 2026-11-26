CREATE TABLE IF NOT EXISTS promotion_uploads (
    filename VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME NOT NULL,
    expires_at DATETIME NULL,
    PRIMARY KEY (filename),
    KEY idx_promotion_uploads_expiry (expires_at, filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
