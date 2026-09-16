import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_AVATAR_SIZE_BYTES, avatarFileError, profileInitials } from '../src/app/shared/utils/profile.util.ts';

describe('profile utilities', () => {
  it('aceita somente imagens suportadas dentro do limite', () => {
    assert.match(avatarFileError(null) ?? '', /Escolha/);
    assert.match(avatarFileError(undefined) ?? '', /Escolha/);
    assert.equal(avatarFileError({ type: 'image/webp', size: MAX_AVATAR_SIZE_BYTES }), null);
    assert.match(avatarFileError({ type: 'image/gif', size: 100 }) ?? '', /JPG, PNG ou WebP/);
    assert.match(avatarFileError({ type: 'image/png', size: 0 }) ?? '', /5 MB/);
    assert.match(avatarFileError({ type: 'image/png', size: MAX_AVATAR_SIZE_BYTES + 1 }) ?? '', /5 MB/);
  });

  it('gera iniciais estáveis para o fallback da foto', () => {
    assert.equal(profileInitials('  Ana   Clara Souza '), 'AC');
    assert.equal(profileInitials('Madonna'), 'M');
    assert.equal(profileInitials('   '), '');
  });
});
