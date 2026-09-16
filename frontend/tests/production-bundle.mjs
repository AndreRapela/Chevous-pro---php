import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const browserOutput = new URL('../dist/chezvoust-pro/browser/', import.meta.url);

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? files(new URL(`${entry.name}/`, directory))
    : [new URL(entry.name, directory)]));
  return nested.flat();
}

const assets = await files(browserOutput);
const source = (await Promise.all(assets
  .filter((asset) => asset.pathname.endsWith('.js'))
  .map((asset) => readFile(asset, 'utf8')))).join('\n');

for (const forbiddenDemoPassword of ['Cliente@123', 'Profissional@123', 'Admin@123']) {
  assert.ok(!source.includes(forbiddenDemoPassword), `Senha de demonstração ${forbiddenDemoPassword} não pode estar no bundle de produção.`);
}

console.log('PASS bundle de produção: sem senhas de demonstração.');
