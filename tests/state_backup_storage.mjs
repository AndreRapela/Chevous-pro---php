import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const owner = `cvp-backup-test-${randomBytes(6).toString('hex')}`;
const volumes = [`${owner}-source`, `${owner}-target`];
const image =
  'andrerapela/chezvous-pro@sha256:8c71e639d9c70a2de3ca091e94fe6fa7d9ce5d16ae135da67b54d4b844931047';

function docker(args, input, expectedStatus = 0) {
  const result = spawnSync('docker', args, { input, maxBuffer: 4 * 1024 * 1024, timeout: 180_000 });
  assert.equal(result.status, expectedStatus, 'Comando Docker falhou; conteúdo privado omitido.');
  return result.stdout;
}

function helper(volume, mode, input, expectedStatus = 0) {
  return docker(
    [
      'run',
      '--rm',
      '-i',
      '--network',
      'none',
      '--read-only',
      '--cap-drop',
      'ALL',
      '--cap-add',
      'DAC_OVERRIDE',
      ...(mode === 'restore' ? ['--cap-add', 'CHOWN'] : []),
      '--mount',
      `type=volume,source=${volume},target=/storage${mode !== 'restore' ? ',readonly' : ''}`,
      '--mount',
      `type=bind,source=${resolve(root, 'scripts/backup/storage.php')},target=/backup/storage.php,readonly`,
      '--entrypoint',
      'php',
      image,
      '/backup/storage.php',
      mode
    ],
    input,
    expectedStatus
  );
}

try {
  for (const volume of volumes)
    docker(['volume', 'create', '--label', `cvp.backup-test=${owner}`, volume]);
  docker([
    'run',
    '--rm',
    '--network',
    'none',
    '--mount',
    `type=volume,source=${volumes[0]},target=/storage`,
    '--entrypoint',
    'php',
    image,
    '-r',
    'mkdir("/storage/uploads/private", 0750, true); file_put_contents("/storage/uploads/private/photo.bin", hex2bin("00ff2a")); file_put_contents("/storage/.env", "DO_NOT_EXPORT=fixture");'
  ]);
  const entries = JSON.parse(helper(volumes[0], 'export').toString('utf8'));
  assert.equal(
    entries.some((entry) => entry.path === '.env'),
    false
  );
  assert.equal(entries.find((entry) => entry.path.endsWith('photo.bin')).content, 'AP8q');
  helper(volumes[0], 'check-empty', undefined, 1);
  helper(volumes[1], 'check-empty');
  helper(volumes[1], 'restore', JSON.stringify(entries));
  assert.deepEqual(JSON.parse(helper(volumes[1], 'export').toString('utf8')), entries);
  helper(volumes[1], 'restore', JSON.stringify(entries), 1);
  const writable = docker([
    'run',
    '--rm',
    '--network',
    'none',
    '--user',
    '33:33',
    '--mount',
    `type=volume,source=${volumes[1]},target=/storage`,
    '--entrypoint',
    'php',
    image,
    '-r',
    'if(file_put_contents("/storage/uploads/private/photo.bin", "updated") === false || file_put_contents("/storage/new-file", "fixture") === false) exit(1);'
  ]);
  assert.equal(writable.length, 0);
  console.log(
    'PASS backup storage: binários, exclusão de .env, volume vazio, round-trip e escrita por www-data.'
  );
} finally {
  for (const volume of volumes) {
    const result = spawnSync('docker', ['volume', 'inspect', volume], { encoding: 'utf8' });
    if (result.status !== 0) continue;
    const [definition] = JSON.parse(result.stdout);
    assert.equal(definition.Name, volume);
    assert.equal(definition.Labels?.['cvp.backup-test'], owner);
    docker(['volume', 'rm', volume]);
  }
}
