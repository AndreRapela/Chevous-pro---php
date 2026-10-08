import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function walk(path) {
  const absolute = join(root, path);
  const entries = await readdir(absolute, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  }));
  return nested.flat();
}

async function source(path) {
  return readFile(join(root, path), 'utf8');
}

const angularFiles = (await walk('frontend/src/app')).filter((path) => extname(path) === '.ts');
const normalizedPath = (path) => path.replaceAll('\\', '/');
const coreFiles = angularFiles.filter((path) => normalizedPath(path).includes('/app/core/'));
const sharedFiles = angularFiles.filter((path) => normalizedPath(path).includes('/app/shared/'));

for (const path of [...coreFiles, ...sharedFiles]) {
  const value = await source(path);
  assert.doesNotMatch(value, /from\s+['"][^'"]*(?:features|layout)\//, `${path} não pode depender de feature ou layout.`);
}

const componentFiles = angularFiles.filter((path) => path.endsWith('.component.ts'));
for (const path of componentFiles) {
  const lines = (await source(path)).split(/\r?\n/).length;
  assert.ok(lines <= 500, `${path} tem ${lines} linhas; extraia estado, utilitários ou subcomponentes antes de ultrapassar 500.`);
}

const serviceFiles = angularFiles.filter((path) => path.endsWith('.service.ts'));
for (const path of serviceFiles) {
  const value = await source(path);
  const classLines = value.slice(Math.max(0, value.indexOf('export class '))).split(/\r?\n/).length;
  assert.ok(classLines <= 450, `${path} tem uma classe de ${classLines} linhas; divida responsabilidades antes de ultrapassar 450.`);
}

const controllerFiles = (await walk('backend/src/Modules')).filter((path) => path.endsWith('Controller.php'));
for (const path of controllerFiles) {
  const lines = (await source(path)).split(/\r?\n/).length;
  assert.ok(lines <= 800, `${path} tem ${lines} linhas; extraia serviços de aplicação antes de ultrapassar 800.`);
}

for (const path of (await walk('backend/src/Core')).filter((file) => file.endsWith('.php'))) {
  assert.doesNotMatch(await source(path), /ChezVoust\\Modules\\/, `${path} não pode depender dos módulos de negócio.`);
}

const styles = await source('frontend/src/styles.scss');
assert.ok(styles.split(/\r?\n/).length <= 5000, 'styles.scss excedeu 5.000 linhas; novos estilos de página devem permanecer encapsulados no componente.');

const routes = await source('frontend/src/app/app.routes.ts');
const serverRoutes = await source('frontend/src/app/app.routes.server.ts');
const angularConfig = JSON.parse(await source('frontend/angular.json'));
const initialBudget = angularConfig.projects['chezvoust-pro'].architect.build.configurations.production.budgets
  .find((budget) => budget.type === 'initial');
assert.equal(initialBudget?.maximumWarning, '950kB', 'Budget inicial deve manter aviso próximo da base real, sem ruído permanente.');
assert.equal(initialBudget?.maximumError, '1.1MB', 'Bundle inicial não pode crescer até o antigo teto permissivo de 1,5 MB.');
assert.match(routes, /path:\s*'pagamento\/:slug'[\s\S]*loadComponent:/, 'Checkout deve continuar lazy-loaded.');
assert.match(routes, /path:\s*'pagamento\/:slug'[\s\S]*?noindex:\s*true/, 'Checkout não deve ser indexável.');
assert.match(serverRoutes, /path:\s*'pagamento\/:slug'[\s\S]*RenderMode\.Client/, 'Checkout deve permanecer client-side para não renderizar formulário sensível no SSR.');

const payment = await source('frontend/src/app/features/checkout/pages/payment/payment.component.ts');
assert.doesNotMatch(payment, /localStorage|sessionStorage|marketplace\.(?:post|pay|payment)|api\.(?:post|patch)/, 'Checkout visual não deve persistir nem transmitir dados financeiros.');
assert.match(payment, /this\.cardForm\.reset\(\)/, 'Checkout deve limpar os campos bancários após a simulação.');

const unitTests = (await walk('frontend/tests')).filter((path) => path.endsWith('.spec.ts'));
const integrationTests = (await walk('tests')).filter((path) => path.endsWith('_flow.ps1') || path.endsWith('compose_smoke.ps1'));
assert.ok(unitTests.length >= 18, 'A quantidade de arquivos unitários não pode regredir abaixo da base auditada.');
assert.ok(integrationTests.length >= 5, 'Os cinco fluxos de integração principais devem permanecer presentes.');

console.log(`PASS arquitetura: ${componentFiles.length} componentes, ${serviceFiles.length} serviços, ${controllerFiles.length} controladores, ${unitTests.length} arquivos unitários e ${integrationTests.length} fluxos de integração.`);
