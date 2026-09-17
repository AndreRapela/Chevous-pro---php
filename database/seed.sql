SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

INSERT INTO users
    (public_id, role, name, email, password_hash, phone, status, locale, timezone, email_verified_at, created_at, updated_at)
VALUES
    ('10000000-0000-4000-8000-000000000001', 'customer', 'Mariana Costa', 'cliente@chezvoust.test', '{{CLIENT_PASSWORD_HASH}}', '11987654321', 'active', 'pt-BR', 'America/Sao_Paulo', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('10000000-0000-4000-8000-000000000002', 'provider', 'Carlos Oliveira', 'profissional@chezvoust.test', '{{PROVIDER_PASSWORD_HASH}}', '11976543210', 'active', 'pt-BR', 'America/Sao_Paulo', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('10000000-0000-4000-8000-000000000003', 'admin', 'Admin ChezVoust', 'admin@chezvoust.test', '{{ADMIN_PASSWORD_HASH}}', NULL, 'active', 'pt-BR', 'America/Sao_Paulo', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('10000000-0000-4000-8000-000000000004', 'provider', 'Ana Beatriz Souza', 'ana.souza@chezvoust.test', '{{PROVIDER_PASSWORD_HASH}}', '11971234567', 'active', 'pt-BR', 'America/Sao_Paulo', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('10000000-0000-4000-8000-000000000005', 'provider', 'Fernanda Alves', 'fernanda.alves@chezvoust.test', '{{PROVIDER_PASSWORD_HASH}}', '11972345678', 'active', 'en-US', 'America/Sao_Paulo', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('10000000-0000-4000-8000-000000000006', 'provider', 'Diego Martins', 'diego.martins@chezvoust.test', '{{PROVIDER_PASSWORD_HASH}}', '11973456789', 'active', 'en-US', 'America/Sao_Paulo', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE
    name = VALUES(name), phone = VALUES(phone), status = 'active', updated_at = UTC_TIMESTAMP();

SET @customer_id := (SELECT id FROM users WHERE email = 'cliente@chezvoust.test');
SET @provider_id := (SELECT id FROM users WHERE email = 'profissional@chezvoust.test');
SET @provider_ana_id := (SELECT id FROM users WHERE email = 'ana.souza@chezvoust.test');
SET @provider_fernanda_id := (SELECT id FROM users WHERE email = 'fernanda.alves@chezvoust.test');
SET @provider_diego_id := (SELECT id FROM users WHERE email = 'diego.martins@chezvoust.test');
SET @admin_id := (SELECT id FROM users WHERE email = 'admin@chezvoust.test');

INSERT INTO professional_profiles
    (user_id, headline, bio, years_experience, base_city, base_state, service_radius_km,
     verification_status, verified_at, rating_avg, reviews_count, completed_jobs, featured, created_at, updated_at)
VALUES
    (@provider_id, 'Especialista em limpeza e pequenos reparos',
     'Profissional cuidadoso, pontual e experiente em serviços residenciais. Atendimento em São Paulo e região.',
     8, 'São Paulo', 'SP', 25, 'approved', UTC_TIMESTAMP(), 5.00, 1, 1, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    (@provider_ana_id, 'Limpeza residencial com atenção aos detalhes',
     'Profissional verificada, especializada em limpeza, lavanderia e organização doméstica.',
     6, 'São Paulo', 'SP', 20, 'approved', UTC_TIMESTAMP(), 4.90, 12, 46, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    (@provider_fernanda_id, 'Especialista em organização e lavanderia',
     'Atendimento residencial cuidadoso para organização de ambientes e tratamento de roupas.',
     7, 'São Paulo', 'SP', 18, 'approved', UTC_TIMESTAMP(), 4.95, 38, 91, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    (@provider_diego_id, 'Reparos e pintura residencial',
     'Profissional para pequenos reparos, montagem e pintura de interiores.',
     9, 'São Paulo', 'SP', 22, 'approved', UTC_TIMESTAMP(), 4.87, 29, 74, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE
    headline = VALUES(headline), bio = VALUES(bio), years_experience = VALUES(years_experience),
    base_city = VALUES(base_city), base_state = VALUES(base_state), verification_status = 'approved',
    featured = VALUES(featured), updated_at = UTC_TIMESTAMP();

INSERT INTO addresses
    (public_id, user_id, label, street, number, complement, neighborhood, city, state, postal_code, is_default, created_at, updated_at)
VALUES
    ('20000000-0000-4000-8000-000000000001', @customer_id, 'Casa', 'Rua das Acácias', '125', 'Apto 42', 'Vila Mariana', 'São Paulo', 'SP', '04110000', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE
    label = VALUES(label), street = VALUES(street), number = VALUES(number), complement = VALUES(complement),
    neighborhood = VALUES(neighborhood), city = VALUES(city), state = VALUES(state), postal_code = VALUES(postal_code),
    is_default = 1, deleted_at = NULL, updated_at = UTC_TIMESTAMP();

SET @address_id := (SELECT id FROM addresses WHERE public_id = '20000000-0000-4000-8000-000000000001');

INSERT INTO service_categories
    (public_id, name, slug, description, icon, color, active, sort_order, created_at, updated_at)
VALUES
    ('30000000-0000-4000-8000-000000000001', 'Limpeza', 'limpeza', 'Limpeza residencial, comercial e especializada.', 'sparkles', '#08B86F', 1, 10, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('30000000-0000-4000-8000-000000000002', 'Lavanderia', 'lavanderia', 'Lavagem, secagem e cuidados com roupas.', 'washing-machine', '#18A8A0', 1, 20, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('30000000-0000-4000-8000-000000000003', 'Reparos', 'reparos', 'Manutenção e pequenos reparos residenciais.', 'tools', '#FFB321', 1, 30, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('30000000-0000-4000-8000-000000000004', 'Pintura', 'pintura', 'Pintura e acabamento para todos os ambientes.', 'paint-roller', '#F05B78', 1, 40, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('30000000-0000-4000-8000-000000000005', 'Montagem', 'montagem', 'Montagem e desmontagem de móveis.', 'package', '#725AC1', 1, 50, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('30000000-0000-4000-8000-000000000006', 'Jardinagem', 'jardinagem', 'Cuidados para jardins, vasos e áreas verdes.', 'leaf', '#4F9D4D', 1, 60, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('30000000-0000-4000-8000-000000000007', 'Organização', 'organizacao', 'Organização de ambientes, armários e mudanças.', 'boxes', '#E1883E', 1, 70, UTC_TIMESTAMP(), UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE
    name = VALUES(name), description = VALUES(description), icon = VALUES(icon), color = VALUES(color),
    active = 1, sort_order = VALUES(sort_order), updated_at = UTC_TIMESTAMP();

SET @cat_cleaning := (SELECT id FROM service_categories WHERE slug = 'limpeza');
SET @cat_laundry := (SELECT id FROM service_categories WHERE slug = 'lavanderia');
SET @cat_repairs := (SELECT id FROM service_categories WHERE slug = 'reparos');
SET @cat_painting := (SELECT id FROM service_categories WHERE slug = 'pintura');
SET @cat_assembly := (SELECT id FROM service_categories WHERE slug = 'montagem');
SET @cat_garden := (SELECT id FROM service_categories WHERE slug = 'jardinagem');
SET @cat_organization := (SELECT id FROM service_categories WHERE slug = 'organizacao');

INSERT INTO services
    (public_id, category_id, name, slug, short_description, description, pricing_type, price_cents, unit_label,
     default_duration_minutes, minimum_quantity, maximum_quantity, active, featured, sort_order, created_at, updated_at)
VALUES
    ('40000000-0000-4000-8000-000000000001', @cat_cleaning, 'Limpeza residencial', 'limpeza-residencial', 'Limpeza completa para sua casa.', 'Limpeza de pisos, superfícies, banheiros, cozinha e quartos.', 'fixed', 14000, 'serviço', 180, 1, 5, 1, 1, 10, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('40000000-0000-4000-8000-000000000002', @cat_cleaning, 'Faxina pesada', 'faxina-pesada', 'Limpeza profunda para ambientes que precisam de cuidado extra.', 'Inclui remoção de sujeira acumulada e detalhamento dos ambientes.', 'fixed', 24000, 'serviço', 300, 1, 5, 1, 1, 20, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('40000000-0000-4000-8000-000000000003', @cat_laundry, 'Lavagem de roupas', 'lavagem-de-roupas', 'Lavagem e separação cuidadosa de roupas.', 'Serviço por hora com orientação do cliente sobre tecidos especiais.', 'hourly', 6000, 'hora', 120, 1, 8, 1, 1, 10, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('40000000-0000-4000-8000-000000000004', @cat_laundry, 'Passadoria', 'passadoria', 'Roupas passadas e organizadas.', 'Passadoria de peças do dia a dia, roupas sociais e enxoval.', 'hourly', 5500, 'hora', 120, 1, 8, 1, 0, 20, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('40000000-0000-4000-8000-000000000005', @cat_repairs, 'Eletricista residencial', 'eletricista-residencial', 'Instalações e pequenos reparos elétricos.', 'Troca de tomadas, luminárias, disjuntores e diagnóstico inicial.', 'hourly', 9000, 'hora', 120, 1, 8, 1, 1, 10, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('40000000-0000-4000-8000-000000000006', @cat_repairs, 'Encanador residencial', 'encanador-residencial', 'Soluções para vazamentos e instalações hidráulicas.', 'Reparos em torneiras, sifões, descargas e tubulações aparentes.', 'hourly', 8500, 'hora', 120, 1, 8, 1, 0, 20, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('40000000-0000-4000-8000-000000000007', @cat_painting, 'Pintura interna', 'pintura-interna', 'Renove paredes e tetos internos.', 'Preço calculado por metro quadrado; materiais não incluídos.', 'area', 2500, 'm²', 360, 5, 1000, 1, 1, 10, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('40000000-0000-4000-8000-000000000008', @cat_assembly, 'Montagem de móveis', 'montagem-de-moveis', 'Montagem segura de móveis residenciais.', 'Armários, mesas, camas, estantes e móveis modulados.', 'hourly', 8000, 'hora', 120, 1, 8, 1, 1, 10, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('40000000-0000-4000-8000-000000000009', @cat_garden, 'Manutenção de jardim', 'manutencao-de-jardim', 'Poda, limpeza e cuidado com áreas verdes.', 'Manutenção por hora para jardins residenciais.', 'hourly', 6500, 'hora', 180, 1, 8, 1, 0, 10, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('40000000-0000-4000-8000-000000000010', @cat_organization, 'Organização de ambientes', 'organizacao-de-ambientes', 'Mais praticidade para armários e cômodos.', 'Triagem e organização funcional com participação do cliente.', 'hourly', 7000, 'hora', 180, 1, 8, 1, 0, 10, UTC_TIMESTAMP(), UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE
    category_id = VALUES(category_id), name = VALUES(name), short_description = VALUES(short_description),
    description = VALUES(description), pricing_type = VALUES(pricing_type), price_cents = VALUES(price_cents),
    unit_label = VALUES(unit_label), default_duration_minutes = VALUES(default_duration_minutes),
    minimum_quantity = VALUES(minimum_quantity), maximum_quantity = VALUES(maximum_quantity), active = 1,
    featured = VALUES(featured), sort_order = VALUES(sort_order), updated_at = UTC_TIMESTAMP();

SET @service_cleaning := (SELECT id FROM services WHERE slug = 'limpeza-residencial');
SET @service_deep_cleaning := (SELECT id FROM services WHERE slug = 'faxina-pesada');
SET @service_laundry := (SELECT id FROM services WHERE slug = 'lavagem-de-roupas');
SET @service_ironing := (SELECT id FROM services WHERE slug = 'passadoria');
SET @service_electric := (SELECT id FROM services WHERE slug = 'eletricista-residencial');
SET @service_plumbing := (SELECT id FROM services WHERE slug = 'encanador-residencial');
SET @service_painting := (SELECT id FROM services WHERE slug = 'pintura-interna');
SET @service_assembly := (SELECT id FROM services WHERE slug = 'montagem-de-moveis');
SET @service_garden := (SELECT id FROM services WHERE slug = 'manutencao-de-jardim');
SET @service_organization := (SELECT id FROM services WHERE slug = 'organizacao-de-ambientes');

INSERT INTO service_addons
    (public_id, service_id, name, description, pricing_type, price_cents, active, sort_order, created_at, updated_at)
VALUES
    ('50000000-0000-4000-8000-000000000001', @service_cleaning, 'Limpeza interna da geladeira', 'Higienização interna com a geladeira vazia.', 'fixed', 3500, 1, 10, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('50000000-0000-4000-8000-000000000002', @service_cleaning, 'Limpeza interna do forno', 'Desengorduramento da área interna.', 'fixed', 3000, 1, 20, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('50000000-0000-4000-8000-000000000003', @service_deep_cleaning, 'Limpeza de janelas', 'Limpeza de janelas acessíveis sem trabalho em altura.', 'quantity', 1500, 1, 10, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('50000000-0000-4000-8000-000000000004', @service_assembly, 'Fixação na parede', 'Fixação simples, quando a estrutura permitir.', 'fixed', 2500, 1, 10, UTC_TIMESTAMP(), UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE
    name = VALUES(name), description = VALUES(description), pricing_type = VALUES(pricing_type),
    price_cents = VALUES(price_cents), active = 1, sort_order = VALUES(sort_order), updated_at = UTC_TIMESTAMP();

INSERT INTO professional_services (professional_id, service_id, price_cents, active, created_at, updated_at)
VALUES
    (@provider_id, @service_cleaning, 14500, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    (@provider_id, @service_deep_cleaning, 24500, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    (@provider_id, @service_electric, 9500, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    (@provider_id, @service_plumbing, 9000, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    (@provider_id, @service_assembly, 8500, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    (@provider_ana_id, @service_cleaning, NULL, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    (@provider_ana_id, @service_deep_cleaning, NULL, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    (@provider_ana_id, @service_laundry, NULL, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    (@provider_ana_id, @service_ironing, NULL, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    (@provider_ana_id, @service_organization, NULL, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    (@provider_fernanda_id, @service_laundry, 6500, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    (@provider_fernanda_id, @service_ironing, 6000, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    (@provider_fernanda_id, @service_organization, 7500, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    (@provider_diego_id, @service_electric, 9800, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    (@provider_diego_id, @service_painting, 2700, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    (@provider_diego_id, @service_assembly, 9000, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE price_cents = VALUES(price_cents), active = 1, updated_at = UTC_TIMESTAMP();

INSERT INTO availability_rules
    (public_id, professional_id, weekday, start_time, end_time, active, created_at, updated_at)
VALUES
    ('51000000-0000-4000-8000-000000000001', @provider_id, 1, '08:00:00', '18:00:00', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('51000000-0000-4000-8000-000000000002', @provider_id, 2, '08:00:00', '18:00:00', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('51000000-0000-4000-8000-000000000003', @provider_id, 3, '08:00:00', '18:00:00', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('51000000-0000-4000-8000-000000000004', @provider_id, 4, '08:00:00', '18:00:00', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('51000000-0000-4000-8000-000000000005', @provider_id, 5, '08:00:00', '18:00:00', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('51000000-0000-4000-8000-000000000006', @provider_id, 6, '08:00:00', '14:00:00', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('52000000-0000-4000-8000-000000000001', @provider_ana_id, 1, '08:00:00', '17:00:00', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('52000000-0000-4000-8000-000000000002', @provider_ana_id, 2, '08:00:00', '17:00:00', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('52000000-0000-4000-8000-000000000003', @provider_ana_id, 3, '08:00:00', '17:00:00', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('52000000-0000-4000-8000-000000000004', @provider_ana_id, 4, '08:00:00', '17:00:00', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('52000000-0000-4000-8000-000000000005', @provider_ana_id, 5, '08:00:00', '17:00:00', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE
    professional_id = VALUES(professional_id), weekday = VALUES(weekday), start_time = VALUES(start_time),
    end_time = VALUES(end_time), active = 1, updated_at = UTC_TIMESTAMP();

INSERT INTO promotions
    (public_id, title, subtitle, cta_label, cta_url, background_color, text_color, active, starts_at, ends_at, sort_order, created_at, updated_at)
VALUES
    ('70000000-0000-4000-8000-000000000001', 'Atendimento organizado', 'Encontre profissionais avaliados para cada necessidade da sua casa.', 'Ver serviços', '/servicos', '#08B86F', '#FFFFFF', 1, NULL, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 365 DAY), 10, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('70000000-0000-4000-8000-000000000002', 'Profissionais verificados', 'Agende com praticidade, acompanhe tudo pelo aplicativo.', 'Encontrar profissional', '/profissionais', '#F7D44A', '#241A1C', 1, NULL, NULL, 20, UTC_TIMESTAMP(), UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE
    title = VALUES(title), subtitle = VALUES(subtitle), cta_label = VALUES(cta_label), cta_url = VALUES(cta_url),
    background_color = VALUES(background_color), text_color = VALUES(text_color), active = 1,
    ends_at = VALUES(ends_at), sort_order = VALUES(sort_order), updated_at = UTC_TIMESTAMP();

INSERT INTO app_settings (setting_key, setting_value, is_public, updated_at)
VALUES
    ('minimum_booking_notice_minutes', '30', 1, UTC_TIMESTAMP()),
    ('booking_horizon_days', '180', 1, UTC_TIMESTAMP()),
    ('support_email', '"suporte@chezvoust.test"', 1, UTC_TIMESTAMP()),
    ('brand_name', '"ChezVoust Pro"', 1, UTC_TIMESTAMP()),
    ('default_currency', '"BRL"', 1, UTC_TIMESTAMP()),
    ('default_locale', '"pt-BR"', 1, UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), is_public = VALUES(is_public), updated_at = UTC_TIMESTAMP();

INSERT INTO bookings
    (public_id, customer_id, professional_id, service_id, address_id, mode, status,
     scheduled_start, scheduled_end, timezone, duration_minutes, quantity, area_sqm, notes,
     address_snapshot, pricing_snapshot, subtotal_cents, discount_cents, service_fee_cents,
     total_cents, professional_amount_cents, currency, completed_at, created_at, updated_at)
VALUES
    ('80000000-0000-4000-8000-000000000001', @customer_id, @provider_id, @service_cleaning, @address_id,
     'direct', 'completed', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY), DATE_ADD(DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY), INTERVAL 3 HOUR),
     'America/Sao_Paulo', 180, 1, NULL, 'Interfone 42. Dar atenção especial à cozinha.',
     JSON_OBJECT('label', 'Casa', 'street', 'Rua das Acácias', 'number', '125', 'complement', 'Apto 42', 'neighborhood', 'Vila Mariana', 'city', 'São Paulo', 'state', 'SP', 'postal_code', '04110000'),
     JSON_OBJECT('serviceId', '40000000-0000-4000-8000-000000000001', 'serviceName', 'Limpeza residencial', 'subtotalCents', 14500, 'discountCents', 0, 'serviceFeeCents', 0, 'totalCents', 14500, 'currency', 'BRL'),
     14500, 0, 0, 14500, 14500, 'BRL', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY), DATE_SUB(UTC_TIMESTAMP(), INTERVAL 16 DAY), DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY))
ON DUPLICATE KEY UPDATE
    customer_id = VALUES(customer_id), professional_id = VALUES(professional_id), service_id = VALUES(service_id),
    address_id = VALUES(address_id), status = 'completed', updated_at = VALUES(updated_at);

SET @completed_booking_id := (SELECT id FROM bookings WHERE public_id = '80000000-0000-4000-8000-000000000001');

INSERT INTO booking_items (booking_id, item_type, reference_id, name, quantity, unit_price_cents, total_cents, created_at)
SELECT @completed_booking_id, 'service', @service_cleaning, 'Limpeza residencial', 1, 14500, 14500, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 16 DAY)
WHERE NOT EXISTS (SELECT 1 FROM booking_items WHERE booking_id = @completed_booking_id);

INSERT INTO conversations (public_id, booking_id, created_at, updated_at)
VALUES ('90000000-0000-4000-8000-000000000001', @completed_booking_id, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 16 DAY), DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 DAY))
ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at);

SET @conversation_id := (SELECT id FROM conversations WHERE booking_id = @completed_booking_id);

INSERT IGNORE INTO conversation_participants (conversation_id, user_id, joined_at)
VALUES
    (@conversation_id, @customer_id, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 16 DAY)),
    (@conversation_id, @provider_id, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 16 DAY));

INSERT INTO messages (public_id, conversation_id, sender_id, message_type, body, created_at)
VALUES
    ('91000000-0000-4000-8000-000000000001', @conversation_id, @customer_id, 'text', 'Olá, Carlos! O interfone é o 42. Obrigada.', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 DAY)),
    ('91000000-0000-4000-8000-000000000002', @conversation_id, @provider_id, 'text', 'Olá, Mariana! Perfeito, estarei aí no horário combinado.', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 DAY))
ON DUPLICATE KEY UPDATE body = VALUES(body);

INSERT INTO reviews
    (public_id, booking_id, customer_id, professional_id, rating, comment, status, created_at, updated_at)
VALUES
    ('a0000000-0000-4000-8000-000000000001', @completed_booking_id, @customer_id, @provider_id, 5,
     'Excelente atendimento: pontual, cuidadoso e muito caprichoso.', 'published', DATE_SUB(UTC_TIMESTAMP(), INTERVAL 13 DAY), DATE_SUB(UTC_TIMESTAMP(), INTERVAL 13 DAY))
ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), status = 'published', updated_at = VALUES(updated_at);

INSERT IGNORE INTO favorites (customer_id, professional_id, created_at)
VALUES (@customer_id, @provider_id, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 DAY));

INSERT INTO notifications (public_id, user_id, type, title, message, data, read_at, created_at)
VALUES
    ('b0000000-0000-4000-8000-000000000001', @customer_id, 'welcome', 'Bem-vinda à ChezVoust Pro', 'Encontre profissionais verificados para cuidar da sua casa.', JSON_OBJECT('route', '/servicos'), NULL, UTC_TIMESTAMP()),
    ('b0000000-0000-4000-8000-000000000002', @provider_id, 'professional.approved', 'Cadastro aprovado', 'Seu perfil profissional está ativo e pode receber reservas.', JSON_OBJECT('route', '/prestador/painel'), UTC_TIMESTAMP(), DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY))
ON DUPLICATE KEY UPDATE title = VALUES(title), message = VALUES(message), data = VALUES(data);
