import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { POSTAL_CODE_PATTERN, formatPostalCode, isBrazilianPostalCode, postalCodeDigits } from '../src/app/shared/utils/postal-code.util.ts';

describe('Brazilian postal code input', () => {
  it('adds the standard mask while typing and pasting', () => {
    assert.equal(formatPostalCode('51170300'), '51170-300');
    assert.equal(formatPostalCode('51170-300'), '51170-300');
    assert.equal(formatPostalCode('5117'), '5117');
    assert.equal(formatPostalCode(' 51.170-300 extra '), '51170-300');
  });

  it('sends only eight digits to the lookup endpoint', () => {
    assert.equal(postalCodeDigits('01001-000'), '01001000');
    assert.equal(postalCodeDigits('010010001234'), '01001000');
  });
});

it('accepts a Belgian postcode without applying the Brazilian mask', () => {
  assert.equal(formatPostalCode(' 1000 '), '1000');
  assert.equal(postalCodeDigits('1000'), '1000');
  assert.equal(POSTAL_CODE_PATTERN.test('1000'), true);
  assert.equal(POSTAL_CODE_PATTERN.test('100'), false);
  assert.equal(isBrazilianPostalCode('1000'), false);
  assert.equal(isBrazilianPostalCode('01001-000'), true);
});
