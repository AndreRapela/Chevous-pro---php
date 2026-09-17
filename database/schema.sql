SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    role ENUM('customer', 'provider', 'admin') NOT NULL DEFAULT 'customer',
    name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NULL,
    avatar_path VARCHAR(255) NULL,
    avatar_updated_at DATETIME NULL,
    status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
    locale VARCHAR(12) NOT NULL DEFAULT 'pt-BR',
    timezone VARCHAR(80) NOT NULL DEFAULT 'America/Sao_Paulo',
    email_verified_at DATETIME NULL,
    phone_verified_at DATETIME NULL,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    deleted_at DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_public_id (public_id),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_role_status (role, status),
    KEY idx_users_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    refresh_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    previous_refresh_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    previous_refresh_expires_at DATETIME NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    expires_at DATETIME NOT NULL,
    last_used_at DATETIME NULL,
    revoked_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_auth_sessions_public_id (public_id),
    KEY idx_auth_sessions_user_active (user_id, revoked_at, expires_at),
    CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_email_verification_hash (token_hash),
    KEY idx_email_verification_user (user_id, used_at, expires_at),
    CONSTRAINT fk_email_verification_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_password_reset_hash (token_hash),
    KEY idx_password_reset_user (user_id, used_at, expires_at),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS professional_profiles (
    user_id BIGINT UNSIGNED NOT NULL,
    headline VARCHAR(160) NULL,
    bio TEXT NULL,
    years_experience TINYINT UNSIGNED NOT NULL DEFAULT 0,
    base_city VARCHAR(100) NULL,
    base_state CHAR(2) NULL,
    service_radius_km SMALLINT UNSIGNED NOT NULL DEFAULT 20,
    verification_status ENUM('pending', 'approved', 'rejected', 'suspended') NOT NULL DEFAULT 'pending',
    verification_notes VARCHAR(1000) NULL,
    verified_at DATETIME NULL,
    rating_avg DECIMAL(3,2) NOT NULL DEFAULT 0,
    reviews_count INT UNSIGNED NOT NULL DEFAULT 0,
    completed_jobs INT UNSIGNED NOT NULL DEFAULT 0,
    featured TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (user_id),
    KEY idx_professional_search (verification_status, base_state, base_city, rating_avg),
    KEY idx_professional_featured (featured, rating_avg, completed_jobs),
    CONSTRAINT fk_professional_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT chk_professional_rating CHECK (rating_avg >= 0 AND rating_avg <= 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS addresses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    label VARCHAR(60) NOT NULL,
    street VARCHAR(180) NOT NULL,
    number VARCHAR(20) NOT NULL,
    complement VARCHAR(100) NULL,
    neighborhood VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state CHAR(2) NOT NULL,
    postal_code VARCHAR(8) NOT NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    deleted_at DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_addresses_public_id (public_id),
    KEY idx_addresses_user (user_id, deleted_at, is_default),
    KEY idx_addresses_location (state, city, postal_code),
    CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_categories (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    description VARCHAR(1000) NULL,
    icon VARCHAR(60) NULL,
    color VARCHAR(20) NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_categories_public_id (public_id),
    UNIQUE KEY uq_categories_slug (slug),
    KEY idx_categories_active_sort (active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS services (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    category_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(140) NOT NULL,
    short_description VARCHAR(250) NULL,
    description TEXT NULL,
    pricing_type ENUM('fixed', 'hourly', 'area') NOT NULL,
    price_cents BIGINT UNSIGNED NOT NULL,
    unit_label VARCHAR(30) NULL,
    default_duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 120,
    minimum_quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    maximum_quantity DECIMAL(10,2) NOT NULL DEFAULT 10000,
    active TINYINT(1) NOT NULL DEFAULT 1,
    featured TINYINT(1) NOT NULL DEFAULT 0,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_services_public_id (public_id),
    UNIQUE KEY uq_services_slug (slug),
    KEY idx_services_category_active (category_id, active, sort_order),
    KEY idx_services_featured (featured, active),
    FULLTEXT KEY ftx_services_search (name, short_description, description),
    CONSTRAINT fk_services_category FOREIGN KEY (category_id) REFERENCES service_categories (id) ON DELETE RESTRICT,
    CONSTRAINT chk_services_price CHECK (price_cents > 0),
    CONSTRAINT chk_services_quantity CHECK (minimum_quantity > 0 AND maximum_quantity >= minimum_quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_addons (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    service_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NULL,
    pricing_type ENUM('fixed', 'hourly', 'quantity') NOT NULL DEFAULT 'fixed',
    price_cents BIGINT UNSIGNED NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_service_addons_public_id (public_id),
    KEY idx_service_addons_service (service_id, active, sort_order),
    CONSTRAINT fk_service_addons_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS professional_services (
    professional_id BIGINT UNSIGNED NOT NULL,
    service_id BIGINT UNSIGNED NOT NULL,
    price_cents BIGINT UNSIGNED NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (professional_id, service_id),
    KEY idx_professional_services_service (service_id, active, professional_id),
    CONSTRAINT fk_professional_services_user FOREIGN KEY (professional_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_professional_services_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS availability_rules (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    professional_id BIGINT UNSIGNED NOT NULL,
    weekday TINYINT UNSIGNED NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_availability_rules_public_id (public_id),
    KEY idx_availability_rules_provider (professional_id, weekday, active, start_time),
    CONSTRAINT fk_availability_rules_user FOREIGN KEY (professional_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT chk_availability_weekday CHECK (weekday BETWEEN 0 AND 6),
    CONSTRAINT chk_availability_times CHECK (end_time > start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS availability_exceptions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    professional_id BIGINT UNSIGNED NOT NULL,
    exception_date DATE NOT NULL,
    type ENUM('available', 'unavailable') NOT NULL,
    start_time TIME NULL,
    end_time TIME NULL,
    reason VARCHAR(250) NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_availability_exceptions_public_id (public_id),
    KEY idx_availability_exceptions_provider (professional_id, exception_date, type),
    CONSTRAINT fk_availability_exceptions_user FOREIGN KEY (professional_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(160) NOT NULL,
    subtitle VARCHAR(300) NULL,
    cta_label VARCHAR(60) NULL,
    cta_url VARCHAR(255) NULL,
    background_color VARCHAR(20) NOT NULL DEFAULT '#08B86F',
    text_color VARCHAR(20) NOT NULL DEFAULT '#FFFFFF',
    active TINYINT(1) NOT NULL DEFAULT 1,
    starts_at DATETIME NULL,
    ends_at DATETIME NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_promotions_public_id (public_id),
    KEY idx_promotions_active_period (active, starts_at, ends_at, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSON NOT NULL,
    is_public TINYINT(1) NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    customer_id BIGINT UNSIGNED NOT NULL,
    professional_id BIGINT UNSIGNED NULL,
    service_id BIGINT UNSIGNED NOT NULL,
    address_id BIGINT UNSIGNED NOT NULL,
    mode ENUM('direct', 'marketplace') NOT NULL,
    status ENUM('draft', 'open', 'confirmed', 'provider_on_the_way', 'in_progress', 'completed', 'cancelled', 'disputed') NOT NULL,
    scheduled_start DATETIME NOT NULL,
    scheduled_end DATETIME NOT NULL,
    timezone VARCHAR(80) NOT NULL,
    duration_minutes SMALLINT UNSIGNED NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    area_sqm DECIMAL(10,2) NULL,
    notes TEXT NULL,
    address_snapshot JSON NOT NULL,
    pricing_snapshot JSON NOT NULL,
    subtotal_cents BIGINT UNSIGNED NOT NULL,
    discount_cents BIGINT UNSIGNED NOT NULL DEFAULT 0,
    service_fee_cents BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_cents BIGINT UNSIGNED NOT NULL,
    professional_amount_cents BIGINT UNSIGNED NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'BRL',
    completed_at DATETIME NULL,
    cancelled_at DATETIME NULL,
    cancellation_reason VARCHAR(500) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_bookings_public_id (public_id),
    KEY idx_bookings_customer (customer_id, created_at, status),
    KEY idx_bookings_provider_schedule (professional_id, scheduled_start, scheduled_end, status),
    KEY idx_bookings_marketplace (mode, status, service_id, created_at),
    CONSTRAINT fk_bookings_customer FOREIGN KEY (customer_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_professional FOREIGN KEY (professional_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_address FOREIGN KEY (address_id) REFERENCES addresses (id) ON DELETE RESTRICT,
    CONSTRAINT chk_booking_schedule CHECK (scheduled_end > scheduled_start),
    CONSTRAINT chk_booking_total CHECK (total_cents >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_id BIGINT UNSIGNED NOT NULL,
    item_type ENUM('service', 'addon', 'adjustment') NOT NULL,
    reference_id BIGINT UNSIGNED NULL,
    name VARCHAR(160) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price_cents BIGINT UNSIGNED NOT NULL,
    total_cents BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY idx_booking_items_booking (booking_id),
    CONSTRAINT fk_booking_items_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_id BIGINT UNSIGNED NOT NULL,
    from_status VARCHAR(30) NULL,
    to_status VARCHAR(30) NOT NULL,
    actor_id BIGINT UNSIGNED NULL,
    reason VARCHAR(500) NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY idx_booking_history_booking (booking_id, created_at),
    CONSTRAINT fk_booking_history_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_history_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_offers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    booking_id BIGINT UNSIGNED NOT NULL,
    professional_id BIGINT UNSIGNED NOT NULL,
    amount_cents BIGINT UNSIGNED NOT NULL,
    message VARCHAR(1000) NULL,
    status ENUM('pending', 'accepted', 'rejected', 'withdrawn', 'expired') NOT NULL DEFAULT 'pending',
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_booking_offers_public_id (public_id),
    UNIQUE KEY uq_booking_offers_booking_provider (booking_id, professional_id),
    KEY idx_booking_offers_booking_status (booking_id, status, created_at),
    CONSTRAINT fk_booking_offers_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_offers_provider FOREIGN KEY (professional_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schedule_day_locks (
    professional_id BIGINT UNSIGNED NOT NULL,
    work_date DATE NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (professional_id, work_date),
    CONSTRAINT fk_schedule_day_locks_provider FOREIGN KEY (professional_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS slot_reservations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_id BIGINT UNSIGNED NOT NULL,
    professional_id BIGINT UNSIGNED NOT NULL,
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NOT NULL,
    status ENUM('held', 'confirmed', 'released') NOT NULL,
    expires_at DATETIME NULL,
    released_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_slot_reservation_booking (booking_id),
    KEY idx_slot_reservation_provider (professional_id, starts_at, ends_at, status),
    KEY idx_slot_reservation_expiry (status, expires_at),
    CONSTRAINT fk_slot_reservation_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
    CONSTRAINT fk_slot_reservation_provider FOREIGN KEY (professional_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    operation VARCHAR(80) NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL,
    request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    response_public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_idempotency_scope (user_id, operation, idempotency_key),
    KEY idx_idempotency_expiry (expires_at),
    CONSTRAINT fk_idempotency_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS favorites (
    customer_id BIGINT UNSIGNED NOT NULL,
    professional_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (customer_id, professional_id),
    KEY idx_favorites_professional (professional_id),
    CONSTRAINT fk_favorites_customer FOREIGN KEY (customer_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_favorites_professional FOREIGN KEY (professional_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    booking_id BIGINT UNSIGNED NULL,
    kind ENUM('booking', 'inquiry') NOT NULL DEFAULT 'booking',
    contact_key VARCHAR(80) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_conversations_public_id (public_id),
    UNIQUE KEY uq_conversations_booking (booking_id),
    UNIQUE KEY uq_conversations_contact_key (contact_key),
    KEY idx_conversations_kind_updated (kind, updated_at),
    KEY idx_conversations_updated (updated_at),
    CONSTRAINT fk_conversations_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    last_read_message_id BIGINT UNSIGNED NULL,
    joined_at DATETIME NOT NULL,
    last_read_at DATETIME NULL,
    PRIMARY KEY (conversation_id, user_id),
    KEY idx_conversation_participants_user (user_id, conversation_id),
    CONSTRAINT fk_conversation_participants_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
    CONSTRAINT fk_conversation_participants_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    conversation_id BIGINT UNSIGNED NOT NULL,
    sender_id BIGINT UNSIGNED NOT NULL,
    message_type ENUM('text', 'system') NOT NULL DEFAULT 'text',
    body TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    deleted_at DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_messages_public_id (public_id),
    KEY idx_messages_conversation (conversation_id, id),
    KEY idx_messages_sender (sender_id, created_at),
    CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    type VARCHAR(80) NOT NULL,
    title VARCHAR(160) NOT NULL,
    message VARCHAR(1000) NOT NULL,
    data JSON NULL,
    read_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_notifications_public_id (public_id),
    KEY idx_notifications_user (user_id, read_at, created_at),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    booking_id BIGINT UNSIGNED NOT NULL,
    customer_id BIGINT UNSIGNED NOT NULL,
    professional_id BIGINT UNSIGNED NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    comment TEXT NULL,
    provider_reply TEXT NULL,
    status ENUM('published', 'hidden') NOT NULL DEFAULT 'published',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_reviews_public_id (public_id),
    UNIQUE KEY uq_reviews_booking (booking_id),
    KEY idx_reviews_professional (professional_id, status, created_at),
    CONSTRAINT fk_reviews_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE RESTRICT,
    CONSTRAINT fk_reviews_customer FOREIGN KEY (customer_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_reviews_professional FOREIGN KEY (professional_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5)
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

CREATE TABLE IF NOT EXISTS content_reports (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    reporter_id BIGINT UNSIGNED NOT NULL,
    content_type ENUM('professional_comment', 'review', 'message') NOT NULL,
    content_public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    reason VARCHAR(500) NOT NULL,
    status ENUM('pending', 'resolved', 'dismissed') NOT NULL DEFAULT 'pending',
    action ENUM('none', 'hidden', 'retained') NOT NULL DEFAULT 'none',
    resolved_by BIGINT UNSIGNED NULL,
    resolved_at DATETIME NULL,
    resolution_note VARCHAR(1000) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_content_reports_reporter_content (reporter_id, content_type, content_public_id),
    UNIQUE KEY uq_content_reports_public_id (public_id),
    KEY idx_content_reports_queue (status, created_at),
    CONSTRAINT fk_content_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_content_reports_resolver FOREIGN KEY (resolved_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_rate_limits (
    rate_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    window_started_at DATETIME NOT NULL,
    hits INT UNSIGNED NOT NULL,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (rate_key),
    KEY idx_api_rate_limits_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_id BIGINT UNSIGNED NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_public_id VARCHAR(80) NULL,
    ip_address VARCHAR(45) NULL,
    request_id VARCHAR(80) NOT NULL,
    metadata JSON NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY idx_audit_actor (actor_id, created_at),
    KEY idx_audit_entity (entity_type, entity_public_id, created_at),
    KEY idx_audit_request (request_id),
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS outbox_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_type VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(80) NOT NULL,
    aggregate_id VARCHAR(80) NULL,
    payload JSON NOT NULL,
    attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    available_at DATETIME NOT NULL,
    processed_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY idx_outbox_pending (processed_at, available_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
