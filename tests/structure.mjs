import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function text(path) {
  return readFile(join(root, path), 'utf8');
}

async function files(path) {
  const base = join(root, path);
  const entries = await readdir(base, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) =>
    entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)]
  ));
  return nested.flat();
}

const required = [
  'frontend/src/app/app.routes.ts',
  'frontend/src/app/features/booking/pages/booking-wizard/booking-wizard.component.ts',
  'backend/public/index.php',
  'backend/routes/api.php',
  'database/schema.sql',
  'database/seed.sql',
  'compose.yaml',
];

for (const path of required) {
  assert.ok((await text(path)).length > 0, `${path} deve existir e não estar vazio.`);
}

const packageJson = JSON.parse(await text('frontend/package.json'));
assert.ok(packageJson.dependencies['@angular/core'], 'Angular deve estar declarado.');
assert.ok(packageJson.dependencies['@angular/ssr'], 'SSR deve estar declarado para tornar as páginas públicas rastreáveis.');
assert.ok(packageJson.scripts.build, 'Script de build deve existir.');
assert.ok(packageJson.scripts.lint, 'Script de lint deve existir.');
assert.ok(packageJson.scripts['test:unit'], 'Suíte unitária deve existir.');
assert.ok(packageJson.scripts['test:coverage'], 'Relatório de cobertura deve existir.');
assert.ok(packageJson.scripts['test:bundle'], 'Auditoria do bundle de produção deve existir.');
assert.ok(packageJson.scripts['test:ssr'], 'Verificação de renderização SSR deve existir.');
assert.match(packageJson.scripts['test:unit'], /node .*--test/, 'A suíte unitária deve usar o executor nativo do Node.');
assert.ok(!packageJson.devDependencies.vitest, 'Vitest não deve voltar como dependência redundante.');
assert.ok(packageJson.devDependencies['@angular/build'], 'O construtor moderno do Angular deve estar declarado.');
assert.ok(!packageJson.devDependencies['@angular-devkit/build-angular'], 'O construtor Webpack legado não deve voltar ao projeto.');
const angularConfig = JSON.parse(await text('frontend/angular.json'));
const angularArchitect = angularConfig.projects['chezvoust-pro'].architect;
assert.equal(angularArchitect.build.builder, '@angular/build:application', 'A produção deve usar o construtor moderno do Angular.');
assert.equal(angularArchitect.build.options.outputMode, 'server', 'Páginas públicas devem ser renderizadas pelo servidor.');
assert.equal(angularArchitect.build.options.ssr.entry, 'src/server.ts', 'O processo SSR deve ter uma entrada explícita.');
assert.equal(angularArchitect.serve.builder, '@angular/build:dev-server', 'O servidor local deve usar o construtor moderno do Angular.');
const productionOptimization = angularArchitect.build.configurations.production.optimization;
assert.equal(productionOptimization.styles.inlineCritical, false, 'CSS crítico inline conflita com a CSP e não deve ser ativado.');
assert.equal(angularArchitect.build.configurations.mock.optimization.styles.inlineCritical, true, 'A hospedagem estática de demonstração deve incluir CSS crítico para evitar conteúdo sem estilo.');

const globalStyles = await text('frontend/src/styles.scss');
assert.match(globalStyles, /\.desktop-service-links\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/s, 'O card de serviços do herói deve distribuir cinco atalhos em colunas iguais.');
const homeHero = await text('frontend/src/app/features/public/components/home-hero/home-hero.component.ts');
const serviceCard = homeHero.match(/<nav class="desktop-service-strip"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? '';
assert.equal((serviceCard.match(/<a /g) ?? []).length, 5, 'O card deve conter apenas os cinco atalhos de serviço.');
assert.doesNotMatch(homeHero, /desktop-(?:booking-preview|promo-card)/, 'Somente os atalhos de serviço devem compor a faixa abaixo do banner.');
assert.match(homeHero, /profissional-limpeza-hero-887\.webp/, 'O banner deve usar a imagem original de fundo verde.');
assert.doesNotMatch(homeHero, /hero-warm/, 'O banner não deve reintroduzir a variante marrom da imagem.');
assert.equal((homeHero.match(/mobile-hero-orb mobile-hero-orb-/g) ?? []).length, 4, 'O herói móvel deve conter quatro círculos decorativos sutis.');
assert.match(globalStyles, /animation:\s*home-orb-float[^;]*infinite/, 'Os círculos do herói móvel devem flutuar continuamente.');
assert.match(globalStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.mobile-hero-orb\s*\{[^}]*animation:\s*none/s, 'A animação decorativa deve respeitar movimento reduzido.');
assert.match(globalStyles, /cvp-home > \.home-deals\s*\{\s*order:\s*2;/, 'As ofertas devem aparecer logo após o herói no celular.');
assert.match(globalStyles, /cvp-home > \.home-categories\s*\{\s*order:\s*3;/, 'Os serviços devem aparecer depois das ofertas no celular.');
assert.match(globalStyles, /body cvp-home \.home-categories \.category-grid\s*\{[^}]*display:\s*flex;[^}]*overflow-x:\s*auto;[^}]*scroll-snap-type:\s*x mandatory;/s, 'A home móvel deve permitir deslizar horizontalmente por todos os serviços.');
assert.match(globalStyles, /body cvp-home \.home-categories \.category-card\s*\{[^}]*flex:\s*0 0 calc\(\(100% - 1\.5rem\) \/ 4\);/s, 'A home móvel deve manter quatro serviços compactos visíveis por vez.');
assert.match(globalStyles, /body cvp-home \.home-popular cvp-service-card\s*\{[^}]*flex:\s*0 0 11\.75rem;/s, 'Os serviços populares não devem ocupar quase toda a largura do celular.');
assert.match(globalStyles, /body cvp-home \.home-providers cvp-provider-card\s*\{[^}]*flex:\s*0 0 13\.75rem;/s, 'Os profissionais recomendados devem permanecer compactos no carrossel móvel.');
assert.match(globalStyles, /body cvp-home \.home-providers \.availability\s*\{\s*display:\s*none;/s, 'O card profissional da home móvel deve priorizar identidade, avaliação, preço e perfil.');
const homePage = await text('frontend/src/app/features/public/pages/home/home.component.ts');
assert.match(homePage, /id="categorias-title">Nossos serviços<\/h2>/, 'A seção compacta deve se apresentar como nossos serviços.');
assert.match(globalStyles, /\.provider-schedule-page \.availability-table tr\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s, 'A agenda mobile deve organizar horários como cartões responsivos.');
assert.match(globalStyles, /\.provider-dashboard-page \.metric-grid,[^}]*grid-template-columns:\s*repeat\(2,/s, 'As métricas do profissional devem permanecer compactas no celular.');
assert.match(globalStyles, /\.portal-header \.icon-button\s*\{[^}]*min-width:\s*2\.75rem/s, 'Ações do cabeçalho devem manter alvo de toque de 44px.');
assert.match(globalStyles, /--public-bottom-nav-height:\s*calc\(4\.4rem \+ env\(safe-area-inset-bottom\)\)/, 'A navegação pública deve declarar uma altura compartilhada com a safe area.');
assert.match(globalStyles, /\.mobile-sticky-action\s*\{[^}]*var\(--public-bottom-nav-height\)/s, 'O CTA fixo do perfil deve ficar acima da navegação inferior.');
assert.match(globalStyles, /body:has\(cvp-provider-detail\) \.site-footer\s*\{[^}]*--mobile-sticky-action-height/s, 'O rodapé do perfil deve reservar espaço para CTA e navegação fixos.');
const publicShell = await text('frontend/src/app/layout/public-shell.component.ts');
assert.doesNotMatch(publicShell, /<cvp-home-hero/, 'O banner da Home não deve reaparecer nos detalhes, perfis ou agendamento.');
assert.match(homePage, /<cvp-home-hero[^>]*>[\s\S]*<section class="section home-section home-deals"/s, 'O banner principal deve aparecer só na Home, antes da oferta da loja.');
assert.equal((homePage.match(/<cvp-home-hero\b/g) ?? []).length, 1, 'A Home deve renderizar um único banner principal.');
assert.equal((publicShell.match(/<details class="footer-group footer-mobile-group">/g) ?? []).length, 3, 'Os grupos móveis do rodapé devem iniciar recolhidos.');
assert.equal((publicShell.match(/class="footer-group footer-desktop-group"/g) ?? []).length, 3, 'O desktop deve manter os três grupos de links visíveis.');
assert.doesNotMatch(publicShell, /<details class="footer-group footer-mobile-group" open>/, 'O rodapé móvel não deve ocupar a tela com todos os grupos abertos.');
assert.match(globalStyles, /\.footer-desktop-group\s*\{\s*display:\s*grid\s*!important;/s, 'Os links do rodapé devem continuar visíveis a partir do breakpoint de desktop.');
const mockApi = await text('frontend/src/app/core/testing/mock-api.service.ts');
assert.doesNotMatch(mockApi, /timer\(120\)/, 'O catálogo local não deve introduzir latência artificial.');
assert.match(globalStyles, /\.locale-popover \{ position: fixed;[^}]*width: min\(14\.5rem,/s, 'O seletor móvel de idioma deve permanecer compacto.');
const professionalsSource = await text('frontend/src/app/features/public/pages/professionals/professionals.component.ts');
assert.match(professionalsSource, /readonly pageSize = 20;/, 'A vitrine deve exibir pelo menos vinte profissionais por página.');
const mockDirectoryData = await text('frontend/src/app/core/testing/mock-data.ts');
const providerBlock = mockDirectoryData.match(/export const MOCK_PROVIDERS: ProviderProfile\[\] = \[([\s\S]*?)\n\];\n\nconst cleaningService/)?.[1] ?? '';
assert.ok((providerBlock.match(/^    id: /gm) ?? []).length >= 20, 'A base local deve oferecer pelo menos vinte profissionais.');
assert.match(globalStyles, /\.enhanced-chat-layout\s*\{[^}]*100dvh/s, 'O chat móvel deve respeitar o viewport dinâmico quando o teclado aparece.');
const publicServiceCard = await text('frontend/src/app/shared/components/service-card/service-card.component.ts');
const publicServiceDetail = await text('frontend/src/app/features/public/pages/service-detail/service-detail.component.ts');
const serviceDetailStyles = await text('frontend/src/app/features/public/pages/service-detail/service-detail.component.scss');
assert.match(publicServiceDetail, /<article[^>]*class="container service-detail-grid"[^>]*>[\s\S]*?<div class="service-detail-copy">[\s\S]*?<div class="service-detail-art"/, 'Texto e retrato devem compartilhar o cartão do banner.');
assert.match(publicServiceDetail, /\[src\]="person\.avatarUrl"/, 'A foto do banner deve ser a foto cadastrada pelo profissional em destaque.');
assert.match(publicServiceDetail, /reducedMotion\.matches/, 'A alternância deve respeitar movimento reduzido.');
assert.match(serviceDetailStyles, /\.service-detail-grid\s*\{[^}]*grid-template-columns:/s, 'O banner deve manter duas colunas na tela estreita.');
assert.doesNotMatch(publicServiceCard, /priceFromCents|A partir de/, 'Cards de serviço não devem mostrar um preço genérico.');
assert.doesNotMatch(publicServiceDetail, /priceFromCents|A partir de/, 'O detalhe do serviço deve deixar o valor para cada profissional.');
assert.match(globalStyles, /\.professionals-results \.provider-card \.chip-row,[\s\S]*display:\s*flex/s, 'Cards de profissionais no celular devem preservar os diferenciais.');

const bookingWizard = await text('frontend/src/app/features/booking/pages/booking-wizard/booking-wizard.component.ts');
const bookingDetails = await text('frontend/src/app/features/booking/components/booking-details-step/booking-details-step.component.ts');
assert.doesNotMatch(bookingDetails, /type="number"/, 'A quantidade do agendamento deve ser ajustada com contador, sem digitação avulsa.');
assert.match(bookingDetails, /role="group" aria-labelledby="booking-quantity-label" aria-describedby="booking-quantity-hint"/, 'O contador deve ter nome e explicação acessíveis.');
assert.match(bookingDetails, /<output id="booking-quantity" aria-live="polite" aria-atomic="true">/, 'Mudanças de quantidade devem ser anunciadas por leitores de tela.');
for (const direction of ['decrease', 'increase']) {
  assert.match(bookingDetails, new RegExp(`class="quantity-${direction}" type="button"[^>]*\\[disabled\\]`), 'Os botões do contador não devem enviar o formulário e devem respeitar os limites.');
}
assert.ok(
  bookingWizard.indexOf('<cvp-booking-price-summary') < bookingWizard.indexOf('<div class="booking-main">'),
  'No celular, o resumo de referência deve aparecer antes do formulário e da ação de continuar.'
);
const homeSource = await text('frontend/src/app/features/public/pages/home/home.component.ts');
assert.match(homeSource, /mobile-scroll-hint/, 'Carrosséis móveis devem indicar visualmente que existe mais conteúdo.');
const documentSource = await text('frontend/src/index.html');
assert.match(documentSource, /<html lang="en-US">/, 'O idioma inicial do documento deve iniciar em inglês.');
assert.match(documentSource, /http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"/, 'A hospedagem estática deve impedir que o navegador reutilize HTML antigo.');
const staticHostingRules = await text('frontend/public/.htaccess');
assert.match(staticHostingRules, /Header always set Cache-Control "no-cache, no-store, must-revalidate"/, 'O documento HTML publicado deve ser sempre revalidado.');
const assetRule = staticHostingRules.match(/<FilesMatch "([^"]+\(css\|js\)[^"]*)">/)?.[1];
assert.ok(assetRule, 'Arquivos com hash precisam de uma regra de cache.');
for (const file of ['main-HS5D52ST.js', 'chunk-CCWN-0RU.js', 'chunk-Y2QJf_TY.js', 'styles-GLWVPLO5.css']) {
  assert.match(file, new RegExp(assetRule));
}
assert.match(staticHostingRules, /Header always set Cache-Control "public, max-age=31536000, immutable"/, 'Arquivos com hash devem manter cache imutável de longa duração.');
const brandComponent = await text('frontend/src/app/shared/components/brand/brand.component.ts');
const brandLogo = await text('frontend/public/pro-logo.svg');
const brandStyles = await text('frontend/src/styles.scss');
assert.doesNotMatch(brandComponent, /brand-name/, 'A marca não deve recompor o nome fora do SVG oficial.');
assert.match(brandStyles, /mask: url\('\/pro-logo\.svg\?v=\d{8}-[a-z-]+'\)/, 'A máscara do logo deve usar a versão atual do SVG.');
assert.match(brandLogo, /<path id="letter-r" d="M95 40[^"]*V90H95Z"/, 'A letra r deve ser vetorial.');
assert.match(brandLogo, /mask="url\(#p-shutter\)"/, 'O P deve ter o obturador da referência, não uma letra tipográfica comum.');
assert.match(brandLogo, /mask="url\(#o-shutter\)"/, 'O o deve usar o mesmo desenho de obturador da referência.');
assert.match(brandLogo, /viewBox="0 0 220 138"/, 'A marca deve preservar a proporção vertical da referência enviada.');
assert.doesNotMatch(brandLogo, /<rect width="220" height="138"/, 'Somente as letras do SVG devem aparecer na máscara.');
assert.match(brandStyles, /\.brand-logo\s*\{[^}]*background-color: var\(--brand-700\)/, 'As letras devem usar o verde nos fundos claros.');
assert.match(brandStyles, /:is\(\.auth-brand-panel, \.site-header, \.site-footer, \.portal-sidebar\) \.brand-logo\s*\{\s*background-color: #fff;/, 'As letras devem ser brancas nos fundos escuros.');
assert.match(documentSource, /name="theme-color" content="#006b4d"/, 'A cor do navegador deve acompanhar a identidade verde.');
assert.match(brandLogo, />Chez vous pro<\/text>/, 'A assinatura deve aparecer centralizada abaixo de Pro.');
assert.equal((brandLogo.match(/<use href="#slit"/g) ?? []).length, 5, 'O obturador deve conter seis lâminas, incluindo a forma-base.');
const seoService = await text('frontend/src/app/core/seo/seo.service.ts');
for (const tag of ['canonical', 'og:title', 'twitter:card', 'application/ld+json', 'noindex, nofollow']) {
  assert.ok(seoService.includes(tag), `Metadado SEO ${tag} ausente.`);
}
const serverRoutes = await text('frontend/src/app/app.routes.server.ts');
assert.match(serverRoutes, /path: 'conta\/\*\*'[\s\S]*RenderMode\.Client/, 'Área autenticada deve permanecer fora do SSR público.');
assert.match(serverRoutes, /path: '\*\*'[\s\S]*status: 404/, 'Rotas inexistentes precisam responder 404 no SSR.');

const routeSource = (await Promise.all([
  'frontend/src/app/app.routes.ts',
  'frontend/src/app/features/public/public.routes.ts',
  'frontend/src/app/features/auth/auth.routes.ts',
  'frontend/src/app/features/customer/customer.routes.ts',
  'frontend/src/app/features/provider/provider.routes.ts',
  'frontend/src/app/features/admin/admin.routes.ts',
].map(text))).join('\n');
for (const route of ['servicos', 'profissionais', 'agendar/:serviceId', 'redefinir-senha', 'verificar-email', 'conta', 'agendamentos/:id', 'prestador', 'admin']) {
  assert.match(routeSource, new RegExp(`path:\\s*['\"]${route.replace('/', '\\/')}['\"]`), `Rota ${route} ausente.`);
}
assert.match(routeSource, /profissionais\/:id\/:slug/, 'Perfil público precisa de URL semântica além do ID técnico.');
assert.match(routeSource, /servicos\/categoria\/:category/, 'Categoria pública precisa de URL indexável.');

const angularFiles = (await files('frontend/src/app')).filter((path) => path.endsWith('.ts'));
for (const path of angularFiles) {
  const source = await text(path);
  const componentCount = (source.match(/@Component\s*\(/g) ?? []).length;
  assert.ok(componentCount <= 1, `${path} deve declarar no máximo um componente Angular.`);
}

const recoverySource = await text('frontend/src/app/features/auth/pages/recover-password/recover-password.component.ts');
assert.match(recoverySource, /AuthShellComponent/, 'Recuperação de senha deve reutilizar o shell de autenticação.');
assert.doesNotMatch(recoverySource, /auth-simple/, 'Recuperação de senha não deve manter um layout paralelo.');

for (const legacy of ['auth-pages.component.ts', 'customer-pages.component.ts', 'provider-pages.component.ts', 'admin-pages.component.ts', 'info-pages.component.ts', 'shared/ui.ts']) {
  assert.ok(!angularFiles.some((path) => path.replaceAll('\\', '/').endsWith(legacy)), `Arquivo agregado legado ainda presente: ${legacy}`);
}

const apiRoutes = await text('backend/routes/api.php');
const routeCount = (apiRoutes.match(/\$router->add\(/g) ?? []).length;
assert.ok(routeCount >= 80, `Contrato REST incompleto: ${routeCount} rotas.`);
for (const endpoint of ['/api/v1/auth/login', '/api/v1/auth/password/reset', '/api/v1/auth/email/verify', '/api/v1/bookings/quote', '/api/v1/provider/dashboard', '/api/v1/provider/availability-exceptions', '/api/v1/admin/dashboard', '/api/v1/seo/robots.txt', '/api/v1/seo/sitemap.xml', '/api/v1/conversations/{id}/events']) {
  assert.ok(apiRoutes.includes(endpoint), `Endpoint ${endpoint} ausente.`);
}

const schema = await text('database/schema.sql');
const tableCount = (schema.match(/CREATE TABLE IF NOT EXISTS/gi) ?? []).length;
assert.ok(tableCount >= 32, `Schema incompleto: ${tableCount} tabelas.`);
assert.match(schema, /KEY idx_messages_conversation \(conversation_id, id\)/, 'Mensagens devem ter índice para leitura incremental por conversa.');
assert.match(schema, /previous_refresh_token_hash/, 'A rotação concorrente de refresh precisa manter o hash anterior por uma janela curta.');
assert.match(schema, /failed_at DATETIME NULL/, 'A outbox deve separar eventos irrecuperáveis da fila ativa.');
assert.match(schema, /last_error VARCHAR\(500\) NULL/, 'A outbox deve guardar um diagnóstico limitado da última falha.');
assert.doesNotMatch(schema, /CREATE TABLE IF NOT EXISTS coupons/i, 'Cupons não pertencem a uma plataforma sem pagamentos.');
assert.doesNotMatch(apiRoutes, /coupons/i, 'A API não deve expor recursos de cupom.');

const engagement = await text('backend/src/Modules/Engagement/EngagementController.php');
assert.match(engagement, /m\.id > :after/, 'Leitura de mensagens deve aceitar cursor incremental.');
assert.match(engagement, /function messageUpdates\(/, 'Chat deve expor atualização autenticada de baixa latência.');
assert.match(apiRoutes, /\/api\/v1\/conversations\/\{id\}\/events', \[\$engagement, 'messageUpdates'\], true/, 'A consulta incremental do chat deve exigir autenticação.');
assert.match(apiRoutes, /\/api\/v1\/professionals\/\{id\}\/conversation/, 'Cliente deve poder iniciar conversa antes de contratar.');
const apiIndex = await text('backend/public/index.php');
assert.match(apiIndex, /\['rateLimiter'\]->check\([\s\S]*global:/, 'A API deve manter o limite global e o fallback SQL antes do roteamento.');
const readLimiter = await text('backend/src/Core/PublicReadLimiter.php');
assert.match(readLimiter, /conversations\/\[\^\/\]\+\/events[^\r\n]*\r?\n\s*return 'chat'/, 'O chat incremental deve ter um limite de leitura próprio.');
assert.doesNotMatch(engagement, /chat-events:user:|chat-events:ip:/, 'Polling do chat não deve duplicar buckets persistentes além do limite global.');
assert.match(engagement, /pollAfterSeconds.*3/, 'A API deve orientar a cadência da consulta incremental.');
assert.doesNotMatch(engagement, /eventStream\(|usleep\(/, 'O chat deve responder sem manter processos PHP em espera.');
assert.match(engagement, /LEFT JOIN conversation_participants contact_participant/, 'A lista do chat deve reutilizar join indexado para o contato, sem subconsultas repetidas.');
assert.match(engagement, /INNER JOIN conversation_participants cp/, 'Mensagens devem ser restritas aos participantes da conversa.');
assert.match(engagement, /senderName[\s\S]*messageType[\s\S]*createdAt/, 'Envio deve devolver um ChatMessage completo.');
assert.match(engagement, /operation = \\'chat\.message\\'/, 'Envio de mensagem deve suportar idempotência.');
assert.match(engagement, /beginTransaction\(\)/, 'Mensagem, atualização e notificação devem ser gravadas atomicamente.');
assert.match(engagement, /MAX\(id\)/, 'Confirmação de leitura deve limitar o cursor ao conteúdo existente.');
assert.match(engagement, /provider_on_the_way/, 'Chat deve permanecer disponível enquanto o profissional está a caminho.');

const bookings = await text('backend/src/Modules/Bookings/BookingController.php');
assert.match(bookings, /IDEMPOTENCY_CONFLICT/, 'Reuso conflitante da chave idempotente deve ser rejeitado.');
assert.match(bookings, /hash_equals\(\(string\) \$existingRequest\['request_hash'\], \$requestHash\)/, 'A chave idempotente deve comparar o conteúdo da requisição.');

const bookingModels = await text('frontend/src/app/core/models/index.ts');
assert.doesNotMatch(bookingModels, /frequency:\s*'once'/, 'Recorrência não implementada não deve permanecer no contrato do frontend.');
assert.doesNotMatch(bookingModels, /PaymentIntent|paymentMethod/, 'Nenhum contrato de pagamento deve permanecer no frontend.');
const providerStep = await text('frontend/src/app/features/booking/components/booking-provider-step/booking-provider-step.component.ts');
assert.match(providerStep, /Receber propostas/, 'Cliente deve conseguir publicar uma solicitação aberta pela interface.');
const marketplaceService = await text('frontend/src/app/core/data-access/marketplace.service.ts');
assert.doesNotMatch(marketplaceService, /payment-intents|payments\//, 'O cliente não deve iniciar cobrança pela plataforma.');
assert.doesNotMatch(marketplaceService, /couponCode/, 'O cliente não deve enviar ou interpretar cupons.');
const bookingWizardSource = await text('frontend/src/app/features/booking/pages/booking-wizard/booking-wizard.component.ts');
assert.doesNotMatch(bookingWizardSource, /coupon/i, 'A reserva não deve expor fluxo de cupom ou desconto.');
const pricing = await text('backend/src/Modules/Bookings/PricingService.php');
assert.doesNotMatch(pricing, /coupon|resolveCoupon/i, 'A precificação não deve consultar cupons.');

const catalog = await text('backend/src/Modules/Catalog/CatalogController.php');
assert.match(catalog, /slot_reservations/, 'Disponibilidade pública deve considerar horários temporariamente reservados.');
assert.match(catalog, /'slots' => \$slots/, 'Disponibilidade pública deve devolver horários calculados.');
assert.match(catalog, /function robots\(/, 'Backend deve gerar robots.txt a partir da URL pública configurada.');
assert.match(catalog, /function sitemap\(/, 'Backend deve gerar sitemap.xml com catálogo e profissionais ativos.');

const authController = await text('backend/src/Modules/Auth/AuthController.php');
assert.match(authController, /'httponly' => true/, 'Token de renovação deve usar cookie HttpOnly.');
assert.doesNotMatch(authController, /'refreshToken' => \$tokens\['refreshToken'\]/, 'Login não deve expor o token de renovação ao JavaScript.');
assert.match(authController, /previous_refresh_expires_at/, 'Refresh concorrente em abas não deve revogar uma sessão válida por corrida.');
assert.match(authController, /DUMMY_PASSWORD_HASH/, 'Falhas de login devem executar uma verificação de senha mesmo para e-mail inexistente.');
assert.match(authController, /login-ip:[\s\S]*100, 900/, 'O limite agregado de login por IP não deve bloquear uma rede após poucas tentativas.');
assert.match(authController, /login-account-ip:[\s\S]*10, 900/, 'Tentativas de login devem ser isoladas por conta e IP.');
const authService = await text('frontend/src/app/core/auth/auth.service.ts');
assert.match(authService, /logout\(\): Observable<void>[\s\S]*tap\(\(\) => this\.session\.clear\(\)\)/, 'A sessão local só deve ser limpa após o servidor confirmar o logout.');
assert.doesNotMatch(authService, /logout\(\): void[\s\S]*error: \(\) => undefined/, 'Falhas de logout não podem ser ocultadas do usuário.');
const response = await text('backend/src/Core/Response.php');
assert.match(response, /Cache-Control: no-store, private/, 'Respostas JSON sem política explícita não devem permanecer em cache.');
const account = await text('backend/src/Modules/Users/AccountController.php');
assert.match(account, /avatar:user:/, 'Envio de avatar deve ter limite de frequência por usuário.');
assert.match(account, /4_000_000/, 'Avatar deve limitar a quantidade de pixels decodificados.');
const phpUploads = await text('backend/docker/php/uploads.ini');
assert.ok(Number(phpUploads.match(/^upload_max_filesize\s*=\s*(\d+)M/m)?.[1]) >= 25, 'O PHP deve aceitar mídia de campanha de 25 MiB.');
assert.ok(Number(phpUploads.match(/^post_max_size\s*=\s*(\d+)M/m)?.[1]) > 25, 'O PHP precisa de folga para o corpo multipart.');
const nginxTemplate = await text('frontend/nginx.conf.template');
assert.ok(Number(nginxTemplate.match(/client_max_body_size (\d+)m/)?.[1]) > 25, 'O Nginx deve aceitar o corpo multipart da mídia de campanha.');

const messageSync = await text('frontend/src/app/features/messaging/data-access/conversation-sync.service.ts');
assert.match(messageSync, /exhaustMap/, 'A atualização da lista de conversas não deve sobrepor requisições.');
assert.match(messageSync, /visibilityState/, 'Sincronização deve pausar quando a página não estiver visível.');
assert.match(messageSync, /conversationMessageUpdates/, 'Mensagens novas devem usar atualização autenticada de baixa latência.');
assert.doesNotMatch(messageSync, /liveStream|\/stream|EventSource/, 'O chat deve manter um único transporte de atualização.');
assert.match(messageSync, /visible\s*\?\s*defer\(nextBatch\)\.pipe\(repeat\(/, 'A consulta incremental deve esperar a anterior terminar e pausar quando oculta.');
assert.match(messageSync, /messagesLatest/, 'A conversa deve iniciar pela janela recente, sem baixar todo o histórico.');
assert.match(messageSync, /before: Number\.MAX_SAFE_INTEGER/, 'A janela recente deve ser solicitada pelo cursor anterior.');
assert.doesNotMatch(messageSync, /expand\(/, 'A sincronização não deve drenar páginas ilimitadas no primeiro acesso.');
const messagesPage = await text('frontend/src/app/features/messaging/pages/messages/messages.component.ts');
assert.match(messagesPage, /data-cvp-no-localize/, 'Mensagens e nomes enviados por usuários não podem ser alterados pela tradução automática.');
assert.match(messagesPage, /loadOlderMessages/, 'O histórico do chat deve ser carregado sob demanda.');
assert.match(messagesPage, /chat-has-selection/, 'No celular, a conversa selecionada deve ocupar a tela de leitura.');
assert.match(messagesPage, /connectionStatusLabel/, 'O chat deve informar quando está conectando ou reconectando.');
assert.match(messagesPage, /shouldSendComposerMessage/, 'O compositor deve preservar Enter para quebra de linha em mobile.');
assert.match(messagesPage, /pendingMessageKey/, 'Reenvio depois de falha precisa manter a mesma chave de idempotência.');
assert.match(marketplaceService, /Idempotency-Key/, 'O cliente deve enviar chave idempotente ao publicar mensagem.');
const productionEnvironment = await text('frontend/src/environments/environment.prod.ts');
const localEnvironment = await text('frontend/src/environments/environment.ts');
const mockEnvironment = await text('frontend/src/environments/environment.mock.ts');
const loginPage = await text('frontend/src/app/features/auth/pages/login/login.component.ts');
assert.match(localEnvironment, /demoAccounts:\s*\{/, 'O login local deve manter os atalhos das contas de teste.');
assert.match(mockEnvironment, /demoAccounts:\s*\{/, 'O ambiente de demonstração deve oferecer os perfis de teste solicitados.');
assert.match(productionEnvironment, /demoAccounts:\s*null/, 'O build de produção não deve expor credenciais de demonstração.');
assert.doesNotMatch(loginPage, /Cliente@123|Profissional@123|Admin@123/, 'A tela de login não deve embutir senhas de demonstração.');
const dockerfile = await text('frontend/Dockerfile');
assert.match(dockerfile, /ARG BUILD_CONFIGURATION=production/, 'A imagem isolada deve compilar em modo de produção por padrão.');
assert.match(dockerfile, /--configuration=["']?\$\{BUILD_CONFIGURATION\}(?:,docker)?/, 'O build do frontend deve aceitar a configuração definida pelo Compose.');

const providerDetail = await text('frontend/src/app/features/public/pages/provider-detail/provider-detail.component.ts');
assert.match(providerDetail, /Avaliações verificadas/, 'Perfil público deve separar avaliações de reservas concluídas.');
assert.match(providerDetail, /Comentários públicos/, 'Perfil público deve exibir comentários da comunidade em uma área distinta.');
assert.match(providerDetail, /data-cvp-no-localize/, 'Conteúdo escrito pelo profissional ou clientes não pode ser alterado pela camada de tradução.');
const localizedContent = await text('frontend/src/app/shared/localization/localized-content.directive.ts');
assert.match(localizedContent, /closest\('\[data-cvp-no-localize\]'\)/, 'A diretiva de tradução deve respeitar o conteúdo criado por usuários.');

for (const endpoint of ['/api/v1/me/avatar', '/api/v1/professionals/{id}/comments', '/api/v1/provider/profile/experiences', '/api/v1/provider/profile/courses']) {
  assert.ok(apiRoutes.includes(endpoint), `Endpoint de perfil profissional ausente: ${endpoint}`);
}
for (const table of ['professional_experiences', 'professional_courses', 'professional_comments']) {
  assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`), `Tabela de perfil profissional ausente: ${table}.`);
}

const showcaseMigration = await text('database/migrations/202609020001_add_professional_showcase_and_feedback.sql');
assert.doesNotMatch(showcaseMigration, /ADD COLUMN IF NOT EXISTS/, 'Migração de perfil deve ser compatível com o MySQL suportado.');
assert.match(showcaseMigration, /information_schema\.columns/, 'Migração de perfil deve verificar colunas antes de alterá-las.');
const brlMigration = await text('database/migrations/202609160002_set_brl_as_base_currency.sql');
assert.match(brlMigration, /INSERT INTO app_settings/, 'Migração de moeda deve usar a tabela de configurações existente.');
const inquiryMigration = await text('database/migrations/202609170001_add_pre_booking_conversations.sql');
assert.doesNotMatch(inquiryMigration, /ADD COLUMN IF NOT EXISTS|ADD UNIQUE INDEX IF NOT EXISTS/, 'Migração de conversa deve ser compatível com o MySQL suportado.');
assert.match(inquiryMigration, /uq_conversations_contact_key/, 'Migração de conversa deve preservar a unicidade do contato pré-reserva.');
const outboxMigration = await text('database/migrations/202609220001_add_outbox_dead_letter.sql');
assert.match(outboxMigration, /information_schema\.columns/, 'Migração da outbox deve ser segura para bancos existentes.');
assert.doesNotMatch(outboxMigration, /ADD COLUMN IF NOT EXISTS/, 'Migração da outbox deve ser compatível com o MySQL suportado.');
const worker = await text('backend/bin/worker.php');
const outbox = await text('backend/src/Modules/Mail/MailOutbox.php');
assert.match(worker, /\$outbox->process\(\)/, 'O worker deve processar a fila de e-mails.');
assert.match(outbox, /attempt >= 8[\s\S]*?failed_at = UTC_TIMESTAMP\(\)/, 'Eventos permanentemente inválidos devem sair da fila ativa após tentativas limitadas.');
assert.match(outbox, /failed_at = UTC_TIMESTAMP\(\)[^"]*payload = JSON_OBJECT\(\)/, 'O descarte da outbox não deve reter tokens sensíveis.');

const compose = await text('compose.yaml');
const productionCompose = await text('compose.production.yaml');
assert.match(compose, /web:\s*\n\s*build:\s*\n[\s\S]*?BUILD_CONFIGURATION: development/, 'O frontend local deve incluir os atalhos de login.');
assert.match(compose, /ssr:\s*\n\s*build:\s*\n[\s\S]*?BUILD_CONFIGURATION: development/, 'O SSR local deve usar o mesmo modo do frontend.');
assert.match(compose, /127\.0\.0\.1:\$\{WEB_PORT:-4200\}:80/, 'A interface com contas de teste deve ficar restrita ao loopback.');
assert.match(productionCompose, /web:\s*\n\s*build:\s*\n\s*args:\s*\n\s*BUILD_CONFIGURATION: production/, 'O overlay público deve remover os atalhos do frontend.');
assert.match(productionCompose, /ssr:\s*\n\s*build:\s*\n\s*args:\s*\n\s*BUILD_CONFIGURATION: production/, 'O overlay público deve remover os atalhos também do SSR.');
assert.equal((productionCompose.match(/ports: !reset \[\]/g) ?? []).length, 3, 'Banco, API e web devem remover as portas herdadas no overlay público.');
assert.doesNotMatch(productionCompose, /web:[\s\S]*?OUTBOX_ENCRYPTION_KEY[\s\S]*?ssr:/, 'O frontend não deve receber o segredo da outbox.');
for (const service of ['database', 'api', 'web', 'ssr', 'worker']) {
  assert.match(compose, new RegExp(`^  ${service}:`, 'm'), `Serviço Compose ${service} ausente.`);
}
assert.ok((compose.match(/PROXY_SHARED_SECRET:/g) ?? []).length >= 3, 'Segredo interno deve chegar à API, web e worker.');
assert.match(compose, /api:[\s\S]*healthcheck:[\s\S]*api\/v1\/health\/live/, 'A sonda de inicialização da API deve funcionar antes de iniciar o worker.');
assert.match(compose, /worker:[\s\S]*healthcheck:[\s\S]*bin\/worker\.php", "--healthcheck"/, 'O Compose deve verificar o sinal do worker.');
assert.match(compose, /worker:[\s\S]*depends_on:[\s\S]*api:[\s\S]*condition: service_healthy/, 'O worker deve aguardar a API migrada e saudável.');
assert.match(compose, /ssr:[\s\S]*SSR_API_URL: http:\/\/api\/api\/v1/, 'SSR deve usar a API interna, sem depender do navegador.');
assert.match(compose, /ssr:[\s\S]*SSR_PROXY_SHARED_SECRET/, 'SSR deve autenticar a propagação interna do IP até a API.');

const nginx = await text('frontend/nginx.conf.template');
assert.match(nginx, /proxy_set_header X-Forwarded-For \$remote_addr;/, 'Nginx deve substituir o IP encaminhado.');
assert.match(nginx, /proxy_set_header X-Proxy-Secret \$\{PROXY_SHARED_SECRET\};/, 'Nginx deve autenticar o proxy interno.');
assert.match(nginx, /resolver 127\.0\.0\.11/, 'Nginx deve usar o DNS interno dinâmico do Docker.');
assert.match(nginx, /proxy_pass \$api_upstream;/, 'Nginx deve resolver novamente a API após recriações.');
assert.match(nginx, /location = \/robots\.txt/, 'robots.txt deve estar disponível na raiz do domínio.');
assert.match(nginx, /location = \/sitemap\.xml/, 'sitemap.xml deve estar disponível na raiz do domínio.');
assert.match(nginx, /location @ssr/, 'Rotas públicas devem alcançar o processo SSR.');
assert.match(nginx, /try_files \$uri @ssr;/, 'Nginx não deve mascarar URLs desconhecidas com index.html e status 200.');
assert.match(nginx, /proxy_set_header X-Client-IP \$remote_addr;/, 'O SSR deve receber apenas o IP observado pelo Nginx.');
assert.match(nginx, /Content-Security-Policy/, 'Nginx deve publicar uma política de segurança de conteúdo.');
assert.match(nginx, /Permissions-Policy/, 'Nginx deve restringir recursos sensíveis do navegador.');
assert.match(nginx, /Strict-Transport-Security/, 'Nginx deve instruir navegadores HTTPS a manter transporte seguro.');

const forbiddenImages = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif']);
const assetRoots = ['frontend/src', 'frontend/public', 'backend', 'database', 'docs', 'tests'];
const sourceFiles = (await Promise.all(assetRoots.map((path) => files(path)))).flat();
const imageFiles = sourceFiles
  .filter((path) => forbiddenImages.has(extname(path).toLowerCase()))
  .map((path) => path.replaceAll('\\', '/'))
  .sort();
assert.deepEqual(imageFiles, [
  'backend/src/Modules/Mail/assets/pro-logo.png',
  'frontend/public/favicon.svg',
  'frontend/public/images/eletricista-login-v1-1280.webp',
  'frontend/public/images/eletricista-login-v1-640.webp',
  'frontend/public/images/eletricista-login-warm-1280.jpg',
  'frontend/public/images/eletricista-login-warm-640.jpg',
  'frontend/public/images/garconete-cadastro-v1-1086.webp',
  'frontend/public/images/garconete-cadastro-v1-640.webp',
  'frontend/public/images/garconete-cadastro-warm-1086.jpg',
  'frontend/public/images/garconete-cadastro-warm-640.jpg',
  'frontend/public/images/perfil-eletricista-rafael-nunes-640.jpg',
  'frontend/public/images/perfil-fotografo-diego-amaral-640.jpg',
  'frontend/public/images/perfil-limpeza-ana-clara-640.jpg',
  'frontend/public/images/perfil-montador-lucas-mendes-640.jpg',
  'frontend/public/images/perfil-pintora-helena-martins-640.jpg',
  'frontend/public/images/perfil-redes-eduardo-santos-640.jpg',
  'frontend/public/images/perfil-tecnico-bruno-almeida-640.jpg',
  'frontend/public/images/profissional-limpeza-hero-480.webp',
  'frontend/public/images/profissional-limpeza-hero-887.webp',
  'frontend/public/images/profissional-limpeza-hero-warm-480.jpg',
  'frontend/public/images/profissional-limpeza-hero-warm-887.jpg',
  'frontend/public/images/promo-laundry-discount-v1.webp',
  'frontend/public/pro-logo.svg'
], `Somente as imagens autorizadas pelo usuário podem existir: ${imageFiles.join(', ')}`);
for (const image of imageFiles) {
  assert.ok((await readFile(join(root, image))).byteLength < 100_000, `${image} deve permanecer otimizada abaixo de 100 KB.`);
}

const mockData = await text('frontend/src/app/core/testing/mock-data.ts');
const profilePhotos = imageFiles
  .filter((path) => path.includes('/perfil-'))
  .map((path) => `/${path.replace('frontend/public/', '')}`);
for (const photo of profilePhotos) {
  assert.equal(mockData.split(`avatarUrl: '${photo}'`).length - 1, 1, `${photo} deve pertencer a exatamente um perfil demonstrativo.`);
}
assert.match(mockData, /id: 'repair-equipment'[\s\S]*serviceIds: \['repair-equipment'\]/, 'O perfil técnico deve oferecer manutenção de equipamentos.');
assert.match(mockData, /id: 'tech-photo'[\s\S]*serviceIds: \['tech-photo'\]/, 'O perfil de fotógrafo deve oferecer fotografia residencial e de eventos.');

const projectFiles = [
  ...(await files('frontend/src')).filter((path) => /\.(?:ts|scss|html)$/.test(path)),
  ...(await files('backend')).filter((path) => /\.php$/.test(path)),
];
for (const path of projectFiles) {
  const value = await text(path);
  assert.doesNotMatch(value, /\b(?:TODO|FIXME)\b/, `${path} contém marcador de trabalho pendente.`);
}

console.log(`PASS estrutura: ${routeCount} rotas REST, ${tableCount} tabelas, ${imageFiles.length} assets visuais autorizados.`);
