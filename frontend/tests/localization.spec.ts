import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { replaceTranslationFragment } from '../src/app/core/localization/localized-text.util.ts';

describe('localization text boundaries', () => {
  it('translates standalone words and repeated phrases', () => {
    assert.equal(replaceTranslationFragment('Valor · Valor', 'Valor', 'Price'), 'Price · Price');
    assert.equal(replaceTranslationFragment('5 profissionais', 'profissionais', 'professionals'), '5 professionals');
  });
  it('preserves words that only contain a translation key', () => {
    assert.equal(replaceTranslationFragment('Valores', 'Valor', 'Price'), 'Valores');
    assert.equal(replaceTranslationFragment('atualizações', 'atual', 'present'), 'atualizações');
    assert.equal(replaceTranslationFragment('desatual', 'atual', 'present'), 'desatual');
    assert.equal(replaceTranslationFragment('desatualizado', 'atual', 'present'), 'desatualizado');
  });
  it('supports Unicode boundaries and punctuation', () => {
    assert.equal(replaceTranslationFragment('état, état.', 'état', 'status'), 'status, status.');
    assert.equal(replaceTranslationFragment('préétat', 'état', 'status'), 'préétat');
    assert.equal(replaceTranslationFragment('état2', 'état', 'status'), 'état2');
    assert.equal(replaceTranslationFragment('A · B', '·', '/'), 'A / B');
  });
  it('leaves empty and absent keys unchanged', () => {
    assert.equal(replaceTranslationFragment('Hello', '', 'Bonjour'), 'Hello');
    assert.equal(replaceTranslationFragment('Hello', 'missing', 'absent'), 'Hello');
  });
});
