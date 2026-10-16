import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { maximumBytes, openState, parseKey, sealState } from './crypto.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const helperImage =
  'andrerapela/chezvous-pro@sha256:8c71e639d9c70a2de3ca091e94fe6fa7d9ce5d16ae135da67b54d4b844931047';
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: Object.fromEntries(
    ['env-file', 'database-container', 'storage-volume', 'input', 'output'].map((name) => [
      name,
      { type: 'string' }
    ])
  )
});

function execute(command, args, input) {
  const result = spawnSync(command, args, {
    input,
    maxBuffer: maximumBytes,
    timeout: 180_000,
    cwd: root
  });
  if (result.error || result.status !== 0) {
    // O stderr de MySQL/PHP pode conter SQL, caminhos privados ou dados pessoais.
    throw new Error(
      `Falha em ${command}; saída omitida para não expor dados. Código: ${result.status ?? 'indisponível'}.`
    );
  }
  return result.stdout;
}

function option(name) {
  if (!values[name]) throw new Error(`Informe --${name}.`);
  return values[name];
}

function storage(mode, input) {
  const volume = option('storage-volume');
  execute('docker', ['volume', 'inspect', volume]);
  return execute(
    'docker',
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
      '--security-opt',
      'no-new-privileges',
      ...(mode === 'restore' ? ['--cap-add', 'CHOWN'] : []),
      '--mount',
      `type=volume,source=${volume},target=/storage${mode !== 'restore' ? ',readonly' : ''}`,
      '--mount',
      `type=bind,source=${resolve(root, 'scripts/backup/storage.php')},target=/backup/storage.php,readonly`,
      '--entrypoint',
      'php',
      helperImage,
      '-d',
      'memory_limit=512M',
      '/backup/storage.php',
      mode
    ],
    input
  );
}

function mysql(command, input) {
  const container = option('database-container');
  const script =
    command === 'dump'
      ? 'export MYSQL_PWD="$MYSQL_PASSWORD"; exec mysqldump --user="$MYSQL_USER" --single-transaction --skip-lock-tables --no-tablespaces --set-gtid-purged=OFF --hex-blob --skip-comments --column-statistics=0 "$MYSQL_DATABASE"'
      : 'export MYSQL_PWD="$MYSQL_PASSWORD"; exec mysql --user="$MYSQL_USER" --database="$MYSQL_DATABASE" --batch --skip-column-names';
  return execute('docker', ['exec', '-i', container, 'sh', '-c', script], input);
}

function loadKey() {
  const lines = readFileSync(resolve(option('env-file')), 'utf8').split(/\r?\n/);
  const matches = lines.filter((line) => /^STATE_BACKUP_KEY=/.test(line));
  if (matches.length !== 1)
    throw new Error('Defina uma única STATE_BACKUP_KEY no arquivo de ambiente privado.');
  return parseKey(matches[0].slice('STATE_BACKUP_KEY='.length).trim());
}

try {
  const action = positionals[0];
  if (positionals.length !== 1 || !['export', 'verify', 'restore'].includes(action)) {
    throw new Error('Use export, verify ou restore. Consulte docs/COMPUTER_MIGRATION.md.');
  }
  const key = loadKey();
  if (action === 'export') {
    const output = resolve(option('output'));
    if (existsSync(output)) throw new Error('O arquivo de destino já existe; escolha outro nome.');
    const revision = execute('git', ['rev-parse', 'HEAD']).toString('utf8').trim();
    // A aplicação e o worker precisam estar parados para coordenar banco e uploads.
    const container = JSON.parse(
      execute('docker', ['inspect', option('database-container')]).toString('utf8')
    )[0];
    const project = container.Config.Labels?.['com.docker.compose.project'];
    if (!project) throw new Error('O banco de origem deve pertencer a um projeto Compose.');
    const running = execute('docker', [
      'ps',
      '--filter',
      `label=com.docker.compose.project=${project}`,
      '--format',
      '{{.Label "com.docker.compose.service"}}'
    ])
      .toString('utf8')
      .trim()
      .split(/\r?\n/);
    if (running.some((service) => service !== 'database' && service !== '')) {
      throw new Error('Pare API, worker, web e SSR desse projeto antes de exportar.');
    }
    const state = {
      version: 1,
      createdAt: new Date().toISOString(),
      revision,
      sql: mysql('dump').toString('utf8'),
      storage: JSON.parse(storage('export').toString('utf8'))
    };
    const encrypted = sealState(state, key);
    openState(encrypted, key);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, encrypted, { flag: 'wx', mode: 0o600 });
    console.log(
      `Backup criptografado criado. SHA-256: ${createHash('sha256').update(encrypted).digest('hex')}`
    );
  } else {
    const input = resolve(option('input'));
    if (statSync(input).size > maximumBytes) throw new Error('Backup excede o limite de 128 MiB.');
    const state = openState(readFileSync(input), key);
    if (action === 'restore') {
      const tables = mysql(
        'query',
        'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE();'
      )
        .toString('utf8')
        .trim();
      if (tables !== '0')
        throw new Error(
          'A restauração exige um banco completamente vazio; nenhum dado foi alterado.'
        );
      storage('check-empty');
      mysql('query', state.sql);
      storage('restore', JSON.stringify(state.storage));
    }
    console.log(
      JSON.stringify({
        operation: action,
        createdAt: state.createdAt,
        revision: state.revision,
        storageEntries: state.storage.length
      })
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
