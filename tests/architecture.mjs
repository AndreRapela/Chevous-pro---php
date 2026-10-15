import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ts = createRequire(join(root, 'frontend/package.json'))('typescript');

function executableStatements(node) {
  let count = 0;
  const visit = (child) => {
    if (ts.isStatement(child) && !ts.isBlock(child) && !ts.isClassDeclaration(child)) count++;
    ts.forEachChild(child, visit);
  };
  visit(node);
  return count;
}

function inspectClasses(path, value, budget) {
  const tree = ts.createSourceFile(path, value, ts.ScriptTarget.Latest, true);
  for (const declaration of tree.statements.filter(ts.isClassDeclaration)) {
    const count = executableStatements(declaration);
    assert.ok(
      count <= budget,
      `${path}: ${count} instruções executáveis; separe responsabilidades antes de ultrapassar ${budget}.`
    );
    for (const method of declaration.members.filter(ts.isMethodDeclaration)) {
      const limit = normalizedPath(path).includes('/core/testing/') ? 400 : 80;
      assert.ok(
        executableStatements(method) <= limit,
        `${path}: ${method.name.getText(tree)} concentra lógica demais.`
      );
    }
  }
}

async function walk(path) {
  const absolute = join(root, path);
  const entries = await readdir(absolute, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const child = join(path, entry.name);
      return entry.isDirectory() ? walk(child) : [child];
    })
  );
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
  assert.doesNotMatch(
    value,
    /from\s+['"][^'"]*(?:features|layout)\//,
    `${path} não pode depender de feature ou layout.`
  );
}

const componentFiles = angularFiles.filter((path) => path.endsWith('.component.ts'));
for (const path of componentFiles) {
  const value = await source(path);
  inspectClasses(path, value, 350);
  assert.ok(
    value.length <= 30000,
    `${path} não deve concentrar mais de 30 KB de lógica e apresentação.`
  );
  const inlineTemplate = value.match(/template:\s*`([\s\S]*?)`/);
  assert.ok(
    !inlineTemplate || inlineTemplate[1].length < 600,
    `${path}: templates extensos devem ter arquivo próprio.`
  );
}

const serviceFiles = angularFiles.filter((path) => path.endsWith('.service.ts'));
for (const path of serviceFiles) {
  const value = await source(path);
  inspectClasses(path, value, 450);
}

const controllerFiles = (await walk('backend/src/Modules')).filter((path) =>
  path.endsWith('Controller.php')
);
for (const path of controllerFiles) {
  assert.ok(
    (await source(path)).length <= 50000,
    `${path}: controladores não devem concentrar mais de 50 KB de código.`
  );
}

for (const path of (await walk('backend/src/Core')).filter((file) => file.endsWith('.php'))) {
  assert.doesNotMatch(
    await source(path),
    /ChezVoust\\Modules\\/,
    `${path} não pode depender dos módulos de negócio.`
  );
}

const styles = await source('frontend/src/styles.scss');
assert.ok(
  styles.split(/\r?\n/).length <= 40 && !/[{}]/.test(styles),
  'styles.scss deve compor módulos, não concentrar estilos de páginas.'
);
for (const path of (await walk('frontend/src/styles')).filter((path) => path.endsWith('.scss'))) {
  assert.ok(
    (await source(path)).split(/\r?\n/).length <= 1500,
    `${path}: divida o módulo por responsabilidade antes de ultrapassar 1.500 linhas formatadas.`
  );
}
const localization = await source('frontend/src/app/core/localization/localization.service.ts');
assert.doesNotMatch(
  localization,
  /const TRANSLATIONS[^=]*=/,
  'O catálogo de textos não pertence à classe de localização.'
);
const bookingController = await source('backend/src/Modules/Bookings/BookingController.php');
assert.doesNotMatch(
  bookingController,
  /schedule_day_locks|private function reserveSchedule/,
  'A reserva transacional da agenda pertence ao serviço próprio.'
);
assert.match(
  await source('backend/src/Modules/Bookings/ScheduleReservationService.php'),
  /AvailabilityPolicy::covers/,
  'A gravação deve usar a regra de disponibilidade compartilhada.'
);
assert.match(
  await source('backend/src/Modules/Catalog/CatalogController.php'),
  /AvailabilityPolicy::covers/,
  'A disponibilidade anunciada deve usar a mesma regra da gravação.'
);

const routes = await source('frontend/src/app/app.routes.ts');
const serverRoutes = await source('frontend/src/app/app.routes.server.ts');
const angularConfig = JSON.parse(await source('frontend/angular.json'));
const initialBudget = angularConfig.projects[
  'chezvoust-pro'
].architect.build.configurations.production.budgets.find((budget) => budget.type === 'initial');
assert.equal(
  initialBudget?.maximumWarning,
  '950kB',
  'Budget inicial deve manter aviso próximo da base real, sem ruído permanente.'
);
assert.equal(
  initialBudget?.maximumError,
  '1.1MB',
  'Bundle inicial não pode crescer até o antigo teto permissivo de 1,5 MB.'
);
assert.match(
  routes,
  /path:\s*'pagamento\/:slug'[\s\S]*loadComponent:/,
  'Checkout deve continuar lazy-loaded.'
);
assert.match(
  routes,
  /path:\s*'pagamento\/:slug'[\s\S]*?noindex:\s*true/,
  'Checkout não deve ser indexável.'
);
assert.match(
  serverRoutes,
  /path:\s*'pagamento\/:slug'[\s\S]*RenderMode\.Client/,
  'Checkout deve permanecer client-side para não renderizar formulário sensível no SSR.'
);

const payment = await source(
  'frontend/src/app/features/checkout/pages/payment/payment.component.ts'
);
assert.doesNotMatch(
  payment,
  /localStorage|sessionStorage|marketplace\.(?:post|pay|payment)|api\.(?:post|patch)/,
  'Checkout visual não deve persistir nem transmitir dados financeiros.'
);
assert.match(
  payment,
  /this\.cardForm\.reset\(\)/,
  'Checkout deve limpar os campos bancários após a simulação.'
);

const unitTests = (await walk('frontend/tests')).filter((path) => path.endsWith('.spec.ts'));
const integrationTests = (await walk('tests')).filter(
  (path) => path.endsWith('_flow.ps1') || path.endsWith('compose_smoke.ps1')
);
assert.ok(
  unitTests.length >= 24,
  'A quantidade de arquivos unitários não pode regredir abaixo da base auditada.'
);
assert.ok(
  integrationTests.length >= 5,
  'Os cinco fluxos de integração principais devem permanecer presentes.'
);

console.log(
  `PASS arquitetura: ${componentFiles.length} componentes, ${serviceFiles.length} serviços, ${controllerFiles.length} controladores, ${unitTests.length} arquivos unitários e ${integrationTests.length} fluxos de integração.`
);
