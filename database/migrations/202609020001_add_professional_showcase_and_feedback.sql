ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_path VARCHAR(255) NULL AFTER phone,
    ADD COLUMN IF NOT EXISTS avatar_updated_at DATETIME NULL AFTER avatar_path;

CREATE TABLE IF NOT EXISTS professional_experiences (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    professional_id BIGINT UNSIGNED NOT NULL,
    role_title VARCHAR(120) NOT NULL,
    company_name VARCHAR(120) NOT NULL,
    description VARCHAR(1000) NULL,
    started_at DATE NOT NULL,
    ended_at DATE NULL,
    is_current TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_professional_experiences_public_id (public_id),
    KEY idx_professional_experiences_profile (professional_id, started_at DESC),
    CONSTRAINT fk_professional_experiences_user FOREIGN KEY (professional_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT chk_professional_experience_dates CHECK (ended_at IS NULL OR ended_at >= started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS professional_courses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    professional_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(160) NOT NULL,
    institution VARCHAR(160) NOT NULL,
    completed_at DATE NULL,
    certificate_url VARCHAR(500) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_professional_courses_public_id (public_id),
    KEY idx_professional_courses_profile (professional_id, completed_at DESC),
    CONSTRAINT fk_professional_courses_user FOREIGN KEY (professional_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS professional_comments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    professional_id BIGINT UNSIGNED NOT NULL,
    author_id BIGINT UNSIGNED NOT NULL,
    body VARCHAR(1200) NOT NULL,
    status ENUM('published', 'hidden') NOT NULL DEFAULT 'published',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_professional_comments_public_id (public_id),
    KEY idx_professional_comments_public (professional_id, status, created_at),
    KEY idx_professional_comments_author (author_id, created_at),
    CONSTRAINT fk_professional_comments_professional FOREIGN KEY (professional_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_professional_comments_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
