SET @update_product_orders = IF(
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'product_orders' AND column_name = 'reconcile_at'
    ),
    'SELECT 1',
    'ALTER TABLE product_orders
        MODIFY COLUMN provider_session_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL,
        MODIFY COLUMN provider_checkout_url VARCHAR(1024) NULL,
        ADD COLUMN provider_request JSON NULL,
        ADD COLUMN reconcile_at DATETIME NULL,
        ADD INDEX idx_product_orders_reconcile (status, reconcile_at, public_id)'
);
PREPARE update_product_orders FROM @update_product_orders;
EXECUTE update_product_orders;
DEALLOCATE PREPARE update_product_orders;

UPDATE product_orders SET reconcile_at = expires_at
WHERE status = 'pending' AND reconcile_at IS NULL;
