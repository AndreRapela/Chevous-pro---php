import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Contract tests inspect the component and its referenced presentation files. */
export function readSource(location, visiting = new Set()) {
  const path = location instanceof URL ? fileURLToPath(location) : resolve(location);
  if (visiting.has(path)) throw new Error(`Circular source reference: ${path}`);
  const source = readFileSync(path, 'utf8');
  const nested = new Set([...visiting, path]);
  if (path.endsWith('.scss')) {
    return source
      .replace(/@use\s+['"]([^'"]+)['"]\s*;/g, (_match, name) => {
        const module = resolve(dirname(path), `${name}.scss`);
        const partial = resolve(dirname(module), `_${module.split(/[\\/]/).at(-1)}`);
        return readSource(existsSync(module) ? module : partial, nested);
      })
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\b0\.(\d+)/g, '.$1')
      .replace(/\s+/g, ' ');
  }
  if (!path.endsWith('.component.ts')) return source;
  const presentation = [...source.matchAll(/(?:templateUrl|styleUrl):\s*['"]([^'"]+)['"]/g)].map(
    (match) => {
      const file = resolve(dirname(path), match[1]);
      const content = readSource(file, nested);
      return file.endsWith('.html')
        ? content.replace(/\s+/g, ' ').replace(/>\s+/g, '>').replace(/\s+</g, '<')
        : content;
    }
  );
  return [source, ...presentation].join('\n');
}
