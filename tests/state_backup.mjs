import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { openState, parseKey, sealState, validateStorage } from '../scripts/backup/crypto.mjs';

const state = {
  version: 1,
  createdAt: '2026-10-16T12:00:00.000Z',
  revision: 'fixture',
  sql: 'CREATE TABLE fixture (id INT); INSERT INTO fixture VALUES (1);',
  storage: [
    {
      path: 'uploads/photo.bin',
      type: 'file',
      content: Buffer.from([0, 255, 42]).toString('base64')
    }
  ]
};

test('preserva SQL, metadados e arquivos binários sem revelar o conteúdo', () => {
  const key = randomBytes(32);
  const encrypted = sealState(state, key);
  assert.deepEqual(openState(encrypted, key), state);
  assert.equal(encrypted.includes(Buffer.from(state.sql)), false);
  assert.notDeepEqual(sealState(state, key), encrypted);
});

test('rejeita chave errada, alteração do cabeçalho, tag, nonce e conteúdo', () => {
  const key = randomBytes(32);
  const encrypted = sealState(state, key);
  assert.throws(() => openState(encrypted, randomBytes(32)));
  for (const offset of [0, 9, 21, encrypted.length - 1]) {
    const tampered = Buffer.from(encrypted);
    tampered[offset] ^= 1;
    assert.throws(() => openState(tampered, key));
  }
  assert.throws(() => openState(encrypted.subarray(0, 20), key));
});

test('aceita somente chaves completas de 256 bits', () => {
  assert.equal(parseKey(randomBytes(32).toString('hex')).length, 32);
  for (const key of ['', 'password', 'a'.repeat(63), 'z'.repeat(64), undefined]) {
    assert.throws(() => parseKey(key));
  }
});

test('recusa travessia de diretório, arquivos de ambiente e caminhos especiais', () => {
  for (const path of [
    '../secret',
    '/root',
    'a/../b',
    'C:/file',
    'a\\b',
    '.env',
    'a/.env.production',
    '.git/config',
    'a//b',
    'a\u0000b'
  ]) {
    assert.throws(() => validateStorage([{ path, type: 'directory' }]));
  }
});

test('recusa duplicatas, links, base64 inválido e inventários malformados', () => {
  for (const entries of [
    null,
    [{ path: 'x', type: 'link' }],
    [{ path: 'x', type: 'file', content: '%%' }],
    [...state.storage, ...state.storage]
  ]) {
    assert.throws(() => validateStorage(entries));
  }
  assert.throws(() => sealState({ ...state, sql: '' }, randomBytes(32)));
  assert.throws(() => sealState({ ...state, version: 2 }, randomBytes(32)));
});
