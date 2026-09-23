INSERT INTO service_categories
    (public_id, name, slug, description, icon, color, active, sort_order, created_at, updated_at)
SELECT
    '30000000-0000-4000-8000-000000000008', 'Outros', 'outros',
    'Serviços personalizados oferecidos por profissionais.', 'letter', '#087E66', 1, 80,
    UTC_TIMESTAMP(), UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM service_categories WHERE slug = 'outros');
