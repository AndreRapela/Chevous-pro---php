-- O catálogo já usa centavos inteiros; esta alteração define sua unidade-base
-- como real brasileiro para novas cotações. Reservas históricas preservam a
-- moeda registrada, evitando reinterpretação financeira de registros antigos.
ALTER TABLE bookings ALTER COLUMN currency SET DEFAULT 'BRL';

INSERT INTO app_settings (setting_key, setting_value, is_public, updated_at)
VALUES ('default_currency', '"BRL"', 1, UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = VALUES(updated_at);
