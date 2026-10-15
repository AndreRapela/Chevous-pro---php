import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createTranslationIndex,
  findExactTranslation
} from '../src/app/core/localization/translation-index.util.ts';

describe('translation lookup', () => {
  it('preserves source-language precedence when English and French labels overlap', () => {
    const rating = { pt: 'Nota', en: 'Rating', fr: 'Note' };
    const note = { pt: 'Observação', en: 'Note', fr: 'Observation' };
    const index = createTranslationIndex([rating, note]);
    assert.equal(findExactTranslation(index, 'Note'), note);
    assert.equal(findExactTranslation(index, 'Nota'), rating);
    assert.equal(findExactTranslation(index, 'Observation'), note);
    assert.equal(findExactTranslation(index, 'missing'), undefined);
  });
  it('keeps the first entry when a legacy source phrase has multiple aliases', () => {
    const first = { pt: 'Casa', en: 'Home', fr: 'Domicile' };
    const alias = { pt: 'Casa', en: 'House', fr: 'Maison' };
    const index = createTranslationIndex([first, alias]);
    assert.equal(findExactTranslation(index, 'Casa'), first);
    assert.equal(findExactTranslation(index, 'House'), alias);
    assert.equal(findExactTranslation(index, 'Maison'), alias);
  });
});
