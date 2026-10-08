import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cardBrand,
  checkoutTotalCents,
  formatCardNumber,
  formatExpiry,
  isValidCardNumber,
  isValidExpiry
} from '../src/app/features/checkout/utils/payment-form.util.ts';

describe('front-only payment form utilities', () => {
  it('formats card and expiry fields without retaining non-numeric input', () => {
    assert.equal(formatCardNumber('4111-1111 1111.1111'), '4111 1111 1111 1111');
    assert.equal(formatCardNumber('123456789012345678901'), '1234 5678 9012 3456 789');
    assert.equal(formatExpiry('12 / 29'), '12/29');
    assert.equal(formatExpiry('1'), '1');
  });

  it('recognizes common brands and validates card numbers with Luhn', () => {
    assert.equal(cardBrand('4111111111111111'), 'visa');
    assert.equal(cardBrand('5555555555554444'), 'mastercard');
    assert.equal(cardBrand('378282246310005'), 'amex');
    assert.equal(cardBrand('6011111111111117'), 'generic');
    assert.equal(isValidCardNumber('4111 1111 1111 1111'), true);
    assert.equal(isValidCardNumber('5555 5555 5555 4444'), true);
    assert.equal(isValidCardNumber('4111 1111 1111 1112'), false);
    assert.equal(isValidCardNumber('0000 0000 0000 0000'), false);
    assert.equal(isValidCardNumber('123'), false);
    assert.equal(isValidCardNumber('12345678901234567890'), false);
  });

  it('rejects expired or malformed dates at the month boundary', () => {
    const reference = new Date(2026, 9, 2);
    assert.equal(isValidExpiry('10/26', reference), true);
    assert.equal(isValidExpiry('11/26', reference), true);
    assert.equal(isValidExpiry('09/26', reference), false);
    assert.equal(isValidExpiry('12/25', reference), false);
    assert.equal(isValidExpiry('13/30', reference), false);
    assert.equal(isValidExpiry('1/30', reference), false);
    assert.equal(isValidExpiry('12/99'), true);
  });

  it('calculates totals in integer cents and normalizes invalid quantities', () => {
    assert.equal(checkoutTotalCents(8990, 3), 26970);
    assert.equal(checkoutTotalCents(8990, 0), 8990);
    assert.equal(checkoutTotalCents(8990, 1.5), 8990);
    assert.equal(checkoutTotalCents(-1, 2), 0);
    assert.equal(checkoutTotalCents(1.5, 2), 0);
  });
});
