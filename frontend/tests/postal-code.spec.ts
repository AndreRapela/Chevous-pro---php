import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatPostalCode, postalCodeDigits } from '../src/app/shared/utils/postal-code.util.ts';

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
