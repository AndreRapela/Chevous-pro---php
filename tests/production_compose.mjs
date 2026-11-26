import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webhookSecret = 'whsec_compose_fixture';

function renderCompose(files, envFile, mode) {
  const secretKey = `sk_${mode}_compose_fixture`;
  const command = [
    'compose', ...files.flatMap((file) => ['-f', file]),
    '--env-file', envFile, 'config', '--format', 'json'
  ];
  const result = spawnSync('docker', command, {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      STORE_PAYMENT_MODE: mode,
      STRIPE_SECRET_KEY: secretKey,
      STRIPE_WEBHOOK_SECRET: webhookSecret,
    }
  });
  assert.equal(result.status, 0, `A configuração do Compose é inválida.\n${result.stderr || result.error || ''}`);
  const config = JSON.parse(result.stdout);
  for (const service of ['api', 'worker']) {
    const environment = config.services[service].environment;
    assert.ok(environment.STORE_PAYMENT_MODE === mode, `${service} deve receber o modo do Stripe.`);
    assert.ok(environment.STRIPE_SECRET_KEY === secretKey, `${service} deve receber a chave configurada para o Stripe.`);
  }
  assert.ok(config.services.api.environment.STRIPE_WEBHOOK_SECRET === webhookSecret, 'A API deve receber o segredo do webhook.');
  assert.ok(!('STRIPE_WEBHOOK_SECRET' in config.services.worker.environment), 'O worker não precisa do segredo do webhook.');
  return config;
}

renderCompose(['compose.yaml'], '.env.example', 'test');
const config = renderCompose(['compose.yaml', 'compose.production.yaml'], '.env.production.example', 'live');

for (const service of ['database', 'api', 'web']) {
  assert.equal(config.services?.[service]?.ports, undefined, `${service} não pode publicar portas no overlay de produção.`);
}
assert.equal(config.services?.web?.build?.args?.BUILD_CONFIGURATION, 'production', 'O frontend público deve usar o build de produção.');
assert.equal(config.services?.ssr?.build?.args?.BUILD_CONFIGURATION, 'production', 'O SSR público deve usar o build de produção.');
assert.ok(!('OUTBOX_ENCRYPTION_KEY' in (config.services?.web?.environment ?? {})), 'O container web não deve receber o segredo da outbox.');

console.log('PASS Compose: configuração do Stripe na API e no worker e isolamento dos serviços de produção.');
