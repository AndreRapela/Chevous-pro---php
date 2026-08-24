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
assert.ok(packageJson.scripts.build, 'Script de build deve existir.');
assert.ok(packageJson.scripts.lint, 'Script de lint deve existir.');
assert.ok(packageJson.scripts['test:unit'], 'Suíte unitária deve existir.');
assert.ok(packageJson.scripts['test:coverage'], 'Relatório de cobertura deve existir.');
assert.match(packageJson.scripts['test:unit'], /node .*--test/, 'A suíte unitária deve usar o executor nativo do Node.');
assert.ok(!packageJson.devDependencies.vitest, 'Vitest não deve voltar como dependência redundante.');
assert.ok(packageJson.devDependencies['@angular/build'], 'O construtor moderno do Angular deve estar declarado.');
assert.ok(!packageJson.devDependencies['@angular-devkit/build-angular'], 'O construtor Webpack legado não deve voltar ao projeto.');
const angularConfig = JSON.parse(await text('frontend/angular.json'));
const angularArchitect = angularConfig.projects['chezvoust-pro'].architect;
assert.equal(angularArchitect.build.builder, '@angular/build:application', 'A produção deve usar o construtor moderno do Angular.');
assert.equal(angularArchitect.serve.builder, '@angular/build:dev-server', 'O servidor local deve usar o construtor moderno do Angular.');
const productionOptimization = angularArchitect.build.configurations.production.optimization;
assert.equal(productionOptimization.styles.inlineCritical, false, 'CSS crítico inline conflita com a CSP e não deve ser ativado.');

const globalStyles = await text('frontend/src/styles.scss');
assert.match(globalStyles, /\.desktop-hero-lower\s*\{[^}]*min-height:\s*8\.5rem/s, 'O herói desktop deve reservar espaço para a prévia sem cobrir a busca.');
assert.match(globalStyles, /\.provider-schedule-page \.availability-table tr\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s, 'A agenda mobile deve organizar horários como cartões responsivos.');
assert.match(globalStyles, /\.provider-dashboard-page \.metric-grid,[^}]*grid-template-columns:\s*repeat\(2,/s, 'As métricas do profissional devem permanecer compactas no celular.');
assert.match(globalStyles, /\.portal-header \.icon-button\s*\{[^}]*min-width:\s*2\.75rem/s, 'Ações do cabeçalho devem manter alvo de toque de 44px.');

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
for (const endpoint of ['/api/v1/auth/login', '/api/v1/auth/password/reset', '/api/v1/auth/email/verify', '/api/v1/bookings/quote', '/api/v1/provider/dashboard', '/api/v1/provider/availability-exceptions', '/api/v1/admin/dashboard']) {
  assert.ok(apiRoutes.includes(endpoint), `Endpoint ${endpoint} ausente.`);
}

const schema = await text('database/schema.sql');
const tableCount = (schema.match(/CREATE TABLE IF NOT EXISTS/gi) ?? []).length;
assert.ok(tableCount >= 35, `Schema incompleto: ${tableCount} tabelas.`);
assert.match(schema, /KEY idx_messages_conversation \(conversation_id, id\)/, 'Mensagens devem ter índice para leitura incremental por conversa.');

const engagement = await text('backend/src/Modules/Engagement/EngagementController.php');
assert.match(engagement, /m\.id > :after/, 'Leitura de mensagens deve aceitar cursor incremental.');
assert.match(engagement, /INNER JOIN conversation_participants cp/, 'Mensagens devem ser restritas aos participantes da conversa.');
assert.match(engagement, /senderName[\s\S]*messageType[\s\S]*createdAt/, 'Envio deve devolver um ChatMessage completo.');
assert.match(engagement, /MAX\(id\)/, 'Confirmação de leitura deve limitar o cursor ao conteúdo existente.');

const bookings = await text('backend/src/Modules/Bookings/BookingController.php');
assert.match(bookings, /IDEMPOTENCY_CONFLICT/, 'Reuso conflitante da chave idempotente deve ser rejeitado.');
assert.match(bookings, /hash_equals\(\(string\) \$existingRequest\['request_hash'\], \$requestHash\)/, 'A chave idempotente deve comparar o conteúdo da requisição.');

const catalog = await text('backend/src/Modules/Catalog/CatalogController.php');
assert.match(catalog, /slot_reservations/, 'Disponibilidade pública deve considerar horários temporariamente reservados.');
assert.match(catalog, /'slots' => \$slots/, 'Disponibilidade pública deve devolver horários calculados.');

const authController = await text('backend/src/Modules/Auth/AuthController.php');
assert.match(authController, /'httponly' => true/, 'Token de renovação deve usar cookie HttpOnly.');
assert.doesNotMatch(authController, /'refreshToken' => \$tokens\['refreshToken'\]/, 'Login não deve expor o token de renovação ao JavaScript.');

const messageSync = await text('frontend/src/app/features/messaging/data-access/conversation-sync.service.ts');
assert.match(messageSync, /exhaustMap/, 'Sincronização de mensagens não deve sobrepor requisições.');
assert.match(messageSync, /visibilityState/, 'Sincronização deve pausar quando a página não estiver visível.');
assert.match(messageSync, /after: messages\.at\(-1\)\?\.sequence/, 'Sincronização deve drenar lotes usando o último cursor.');

const compose = await text('compose.yaml');
for (const service of ['database', 'api', 'web', 'worker']) {
  assert.match(compose, new RegExp(`^  ${service}:`, 'm'), `Serviço Compose ${service} ausente.`);
}
assert.ok((compose.match(/PROXY_SHARED_SECRET:/g) ?? []).length >= 3, 'Segredo interno deve chegar à API, web e worker.');

const nginx = await text('frontend/nginx.conf.template');
assert.match(nginx, /proxy_set_header X-Forwarded-For \$remote_addr;/, 'Nginx deve substituir o IP encaminhado.');
assert.match(nginx, /proxy_set_header X-Proxy-Secret \$\{PROXY_SHARED_SECRET\};/, 'Nginx deve autenticar o proxy interno.');
assert.match(nginx, /resolver 127\.0\.0\.11/, 'Nginx deve usar o DNS interno dinâmico do Docker.');
assert.match(nginx, /proxy_pass \$api_upstream;/, 'Nginx deve resolver novamente a API após recriações.');
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
  'frontend/public/images/eletricista-login-v1-1280.webp',
  'frontend/public/images/eletricista-login-v1-640.webp',
  'frontend/public/images/garconete-cadastro-v1-1086.webp',
  'frontend/public/images/garconete-cadastro-v1-640.webp',
  'frontend/public/images/profissional-limpeza-hero-480.webp',
  'frontend/public/images/profissional-limpeza-hero-887.webp'
], `Somente as imagens autorizadas pelo usuário podem existir: ${imageFiles.join(', ')}`);
for (const image of imageFiles) {
  assert.ok((await readFile(join(root, image))).byteLength < 100_000, `${image} deve permanecer otimizada abaixo de 100 KB.`);
}

const projectFiles = [
  ...(await files('frontend/src')).filter((path) => /\.(?:ts|scss|html)$/.test(path)),
  ...(await files('backend')).filter((path) => /\.php$/.test(path)),
];
for (const path of projectFiles) {
  const value = await text(path);
  assert.doesNotMatch(value, /\b(?:TODO|FIXME)\b/, `${path} contém marcador de trabalho pendente.`);
}

console.log(`PASS estrutura: ${routeCount} rotas REST, ${tableCount} tabelas, 6 variantes WebP autorizadas.`);
