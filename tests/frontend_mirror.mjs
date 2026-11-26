import { isUtf8 } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = fileURLToPath(new URL('../frontend/', import.meta.url));
const mirror = resolve(process.argv[2] ?? fileURLToPath(new URL('../../chevous-pro---angular/', import.meta.url)));
const exclusions = ['.github', 'node_modules', 'dist', '.angular', '.cache', 'coverage', 'test-results', 'playwright-report'];
const repositoryFiles = new Set(['.gitignore', '.gitattributes', 'README.md', 'LICENSE']);

function filesIn(directory) {
  const paths = execFileSync('git', [
    '-C', directory, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '.',
    ...exclusions.map((path) => `:(exclude)${path}`),
  ], { encoding: 'utf8' });
  return new Set(paths.split('\0').filter((path) => {
    const name = basename(path);
    return path !== '' && !repositoryFiles.has(path) && (name === '.env.example' || !/^\.env(?:\.|$)/.test(name));
  }));
}

async function contents(directory, path) {
  try {
    const bytes = await readFile(resolve(directory, path));
    if (isUtf8(bytes) && !bytes.includes(0)) {
      return Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'));
    }
    return bytes;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

const frontendFiles = filesIn(frontend);
const mirrorFiles = filesIn(mirror);
const differences = [];
const paths = [...new Set([...frontendFiles, ...mirrorFiles])].sort();
for (const path of paths) {
  const [original, copy] = await Promise.all([
    frontendFiles.has(path) ? contents(frontend, path) : null,
    mirrorFiles.has(path) ? contents(mirror, path) : null,
  ]);
  if (original && !copy) differences.push(`Falta no espelho  ${path}`);
  if (copy && !original) differences.push(`Falta no frontend PHP  ${path}`);
  if (original && copy && !original.equals(copy)) differences.push(`Conteúdo diferente  ${path}`);
}

if (differences.length) {
  console.error(`As cópias do frontend divergem em ${differences.length} arquivo(s).\n${differences.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`PASS frontend sincronizado  ${paths.length} arquivos comparados.`);
}
