ALTER TABLE bookings ALTER COLUMN currency SET DEFAULT 'EUR';
ALTER TABLE users ALTER COLUMN locale SET DEFAULT 'pt-BR';

UPDATE app_settings
SET setting_value = '"EUR"', updated_at = UTC_TIMESTAMP()
WHERE setting_key = 'default_currency';

UPDATE app_settings
SET setting_value = '"pt-BR"', updated_at = UTC_TIMESTAMP()
WHERE setting_key = 'default_locale';

UPDATE bookings SET currency = 'EUR' WHERE currency = 'BRL';
