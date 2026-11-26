import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { countryForPhone, internationalPhone, phoneCountryOptions, phoneFlagUrl, phoneWithCountry } from '../src/app/features/auth/registration-phone.ts';

describe('international registration phone', () => {
  it('fills and replaces the prefix while retaining the local digits', () => {
    assert.equal(phoneWithCountry('', 'BE'), '+32 ');
    assert.equal(phoneWithCountry('+32471234567', 'FR'), '+33 471234567');
    assert.equal(phoneWithCountry('0471 23 45 67', 'BE'), '+32 0471 23 45 67');
  });

  it('detects typed prefixes and resolves shared codes when the number identifies the country', () => {
    assert.equal(countryForPhone('+55', 'BE'), 'BR');
    assert.equal(countryForPhone('0032', 'BR'), 'BE');
    assert.equal(countryForPhone('+1', 'BE'), undefined);
    assert.equal(countryForPhone('+1', 'CA'), 'CA');
    assert.equal(countryForPhone('+14165550123', 'BE'), 'CA');
    assert.equal(countryForPhone('+12025550123', 'CA'), 'US');
  });

  it('normalizes local Belgian numbers and pasted international numbers', () => {
    assert.equal(internationalPhone('02 123 45 67', 'BE'), '+3221234567');
    assert.equal(internationalPhone('+32 0471 23 45 67', 'BE'), '+32471234567');
    assert.equal(internationalPhone('0055 81 99546-6520', 'BE'), '+5581995466520');
    assert.equal(internationalPhone('+29022158', 'BE'), '+29022158');
    assert.equal(internationalPhone('+32', 'BE'), undefined);
  });

  it('has localized names and a local flag for every selectable country', () => {
    const options = phoneCountryOptions('fr-FR');
    assert.equal(options.find((option) => option.country === 'BE')?.name, 'Belgique');
    const flagDirectory = new URL('../node_modules/flag-icons/flags/4x3/', import.meta.url);
    for (const option of options) {
      assert.ok(existsSync(new URL(phoneFlagUrl(option.country).replace('flags/', ''), flagDirectory)), option.country);
    }
  });
});
