import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const command = [
  'compose', '-f', 'compose.yaml', '-f', 'compose.production.yaml',
  '--env-file', '.env.production.example', 'config', '--format', 'json'
];
const result = spawnSync('docker', command, { cwd: root, encoding: 'utf8' });

assert.equal(result.status, 0, `A configuração de produção é inválida.\n${result.stderr || result.stdout}`);
const config = JSON.parse(result.stdout);

for (const service of ['database', 'api', 'web']) {
  assert.equal(config.services?.[service]?.ports, undefined, `${service} não pode publicar portas no overlay de produção.`);
}
assert.equal(config.services?.web?.build?.args?.BUILD_CONFIGURATION, 'production', 'O frontend público deve usar o build de produção.');
assert.equal(config.services?.ssr?.build?.args?.BUILD_CONFIGURATION, 'production', 'O SSR público deve usar o build de produção.');
assert.ok(!('OUTBOX_ENCRYPTION_KEY' in (config.services?.web?.environment ?? {})), 'O container web não deve receber o segredo da outbox.');

console.log('PASS Compose de produção: sem portas publicadas, sem segredo excedente e com frontend seguro.');
