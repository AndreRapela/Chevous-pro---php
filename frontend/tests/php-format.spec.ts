import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { it } from 'node:test';
import { format, resolveConfig } from 'prettier';

const require = createRequire(import.meta.url);
const Engine = require('php-parser');
const parser = new Engine({
  parser: { extractDoc: false, suppressErrors: false, version: '8.4' },
  ast: { withPositions: false }
});
const ignored = new Set([
  'loc',
  'raw',
  'leadingComments',
  'trailingComments',
  'comments',
  'isDoubleQuote',
  'shortForm',
  'parenthesizedExpression'
]);
function semantics(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(semantics);
  if (!value || typeof value !== 'object') return value;
  const node = value as Record<string, unknown>;
  if (node['kind'] === 'block' && Array.isArray(node['children']) && node['children'].length === 1)
    return semantics(node['children'][0]);
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => !ignored.has(key))
      .map(([key, child]) => [key, semantics(child)])
  );
}
async function files(path: string): Promise<string[]> {
  return (
    await Promise.all(
      (await readdir(path, { withFileTypes: true })).map((entry) =>
        entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)]
      )
    )
  ).flat();
}

it('the PHP formatter preserves the parsed meaning of all backend source files', async () => {
  const backend = fileURLToPath(new URL('../../backend/', import.meta.url));
  for (const path of (await files(backend)).filter((path) => path.endsWith('.php'))) {
    const source = await readFile(path, 'utf8');
    const formatted = await format(source, {
      ...(await resolveConfig(path)),
      plugins: [require.resolve('@prettier/plugin-php')],
      filepath: path
    });
    assert.deepEqual(
      semantics(parser.parseCode(formatted)),
      semantics(parser.parseCode(source)),
      `Formatting changes PHP behavior: ${path}`
    );
  }
});
