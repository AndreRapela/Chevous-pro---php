import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
assert.doesNotMatch(
  readFileSync(resolve(root, 'frontend/Dockerfile'), 'utf8'),
  /--optimization(?:=|\s)/,
  'O build Docker deve respeitar a política de CSS e CSP definida em angular.json.'
);
const command = [
  'compose',
  '-f',
  'compose.yaml',
  '-f',
  'compose.production.yaml',
  '--env-file',
  '.env.production.example',
  'config',
  '--format',
  'json'
];
const result = spawnSync('docker', command, { cwd: root, encoding: 'utf8' });

assert.equal(
  result.status,
  0,
  `A configuração de produção é inválida.\n${result.stderr || result.stdout}`
);
const config = JSON.parse(result.stdout);

for (const service of ['database', 'api', 'web']) {
  assert.equal(
    config.services?.[service]?.ports,
    undefined,
    `${service} não pode publicar portas no overlay de produção.`
  );
}
assert.equal(
  config.services?.web?.build?.args?.BUILD_CONFIGURATION,
  'production',
  'O frontend público deve usar o build de produção.'
);
assert.equal(
  config.services?.ssr?.build?.args?.BUILD_CONFIGURATION,
  'production',
  'O SSR público deve usar o build de produção.'
);
assert.ok(
  !('OUTBOX_ENCRYPTION_KEY' in (config.services?.web?.environment ?? {})),
  'O container web não deve receber o segredo da outbox.'
);

const registryCommand = [...command];
registryCommand.splice(5, 0, '-f', 'compose.registry.yaml');
const registryResult = spawnSync('docker', registryCommand, {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, IMAGE_TAG: 'validated-test-revision' }
});
assert.equal(
  registryResult.status,
  0,
  `A configuração de imagens publicadas é inválida.\n${registryResult.stderr || registryResult.stdout}`
);
const registryConfig = JSON.parse(registryResult.stdout);
for (const [service, image] of Object.entries({
  api: 'api',
  worker: 'api',
  web: 'web',
  ssr: 'ssr'
})) {
  const definition = registryConfig.services[service];
  assert.equal(
    definition.image,
    `andrerapela/chezvous-pro:${image}-validated-test-revision`,
    `${service} deve usar uma imagem da revisão explícita.`
  );
  assert.equal(definition.build, undefined, `${service} não deve reconstruir código local.`);
  assert.equal(definition.ports, undefined, `${service} não deve abrir portas públicas.`);
  assert.ok(
    !(definition.volumes ?? []).some(
      (volume) => volume.type === 'bind' && volume.target !== '/var/www/database'
    ),
    `${service} não deve substituir o código da imagem por arquivos locais.`
  );
}
for (const service of ['api', 'worker']) {
  const volumes = registryConfig.services[service].volumes;
  assert.ok(
    volumes.some((volume) => volume.target === '/var/www/database' && volume.read_only),
    `${service} precisa das migrações somente para leitura.`
  );
  assert.ok(
    volumes.some((volume) => volume.type === 'volume' && volume.target === '/var/www/html/storage'),
    `${service} deve persistir uploads e arquivos de execução fora da imagem.`
  );
}
assert.equal(registryConfig.services.api.environment.AUTO_SEED, 'false');
assert.equal(registryConfig.services.api.environment.APP_ENV, 'production');
const missingTagEnvironment = { ...process.env };
delete missingTagEnvironment.IMAGE_TAG;
const missingTagResult = spawnSync('docker', registryCommand, {
  cwd: root,
  encoding: 'utf8',
  env: missingTagEnvironment
});
assert.notEqual(missingTagResult.status, 0, 'A publicação exige uma revisão explícita.');

console.log(
  'PASS Compose de produção e registry: revisão explícita, sem build local, bind de código ou portas públicas.'
);
