import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

const magic = Buffer.from('CVPSTATE1\n');
export const maximumBytes = 128 * 1024 * 1024;

export function parseKey(value) {
  if (!/^[a-f\d]{64}$/i.test(value ?? '')) {
    throw new Error('STATE_BACKUP_KEY deve conter uma chave aleatória de 32 bytes em hexadecimal.');
  }
  return Buffer.from(value, 'hex');
}

export function validateStorage(entries) {
  if (!Array.isArray(entries)) throw new Error('Inventário de armazenamento inválido.');
  const paths = new Set();
  for (const entry of entries) {
    const segments = typeof entry.path === 'string' ? entry.path.split('/') : [];
    if (
      !segments.length ||
      segments.some(
        (part) =>
          !part || part === '.' || part === '..' || /^\.env(?:\.|$)/i.test(part) || part === '.git'
      ) ||
      /[\\:\x00-\x1f]/.test(entry.path) ||
      paths.has(entry.path) ||
      !['directory', 'file'].includes(entry.type)
    ) {
      throw new Error('Caminho de armazenamento inseguro ou duplicado.');
    }
    paths.add(entry.path);
    if (
      entry.type === 'file' &&
      (typeof entry.content !== 'string' ||
        Buffer.from(entry.content, 'base64').toString('base64') !== entry.content)
    ) {
      throw new Error('Conteúdo de armazenamento inválido.');
    }
  }
}

function validateState(state) {
  if (
    state?.version !== 1 ||
    typeof state.sql !== 'string' ||
    !state.sql.trim() ||
    !state.createdAt ||
    !state.revision
  ) {
    throw new Error('Formato do backup inválido.');
  }
  validateStorage(state.storage);
}

export function sealState(state, key) {
  validateState(state);
  const plain = Buffer.from(JSON.stringify(state));
  if (plain.length > maximumBytes) throw new Error('Backup excede o limite de 128 MiB.');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
  cipher.setAAD(magic);
  const encrypted = Buffer.concat([cipher.update(gzipSync(plain)), cipher.final()]);
  return Buffer.concat([magic, nonce, cipher.getAuthTag(), encrypted]);
}

export function openState(encrypted, key) {
  if (
    encrypted.length < magic.length + 29 ||
    encrypted.length > maximumBytes ||
    !encrypted.subarray(0, magic.length).equals(magic)
  ) {
    throw new Error('Arquivo de backup inválido ou incompleto.');
  }
  const offset = magic.length;
  const decipher = createDecipheriv('aes-256-gcm', key, encrypted.subarray(offset, offset + 12), {
    authTagLength: 16
  });
  decipher.setAAD(magic);
  decipher.setAuthTag(encrypted.subarray(offset + 12, offset + 28));
  let plain;
  try {
    plain = Buffer.concat([decipher.update(encrypted.subarray(offset + 28)), decipher.final()]);
  } catch {
    throw new Error('Chave incorreta ou backup adulterado.');
  }
  const state = JSON.parse(gunzipSync(plain, { maxOutputLength: maximumBytes }).toString('utf8'));
  validateState(state);
  return state;
}
