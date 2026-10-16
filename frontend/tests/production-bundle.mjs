import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const browserOutput = new URL('../dist/chezvoust-pro/browser/', import.meta.url);

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? files(new URL(`${entry.name}/`, directory))
        : [new URL(entry.name, directory)]
    )
  );
  return nested.flat();
}

const assets = await files(browserOutput);
for (const asset of assets.filter((asset) => asset.pathname.endsWith('.html'))) {
  assert.doesNotMatch(
    await readFile(asset, 'utf8'),
    /<link\b[^>]*\bonload\s*=/i,
    'O CSS de produção não pode depender de um handler inline bloqueado pela CSP.'
  );
}
const source = (
  await Promise.all(
    assets.filter((asset) => asset.pathname.endsWith('.js')).map((asset) => readFile(asset, 'utf8'))
  )
).join('\n');

for (const forbiddenDemoPassword of ['Cliente@123', 'Profissional@123', 'Admin@123']) {
  assert.ok(
    !source.includes(forbiddenDemoPassword),
    `Senha de demonstração ${forbiddenDemoPassword} não pode estar no bundle de produção.`
  );
}

console.log('PASS bundle de produção: CSS compatível com CSP e sem senhas de demonstração.');
