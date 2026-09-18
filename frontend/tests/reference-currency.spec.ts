import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { convertReferenceAmount, displayReferenceAmount, referenceAmountToCents } from '../src/app/core/localization/reference-currency.util.ts';

describe('reference currency form amounts', () => {
  it('converts historical amounts to the selected EUR/USD preference', () => {
    assert.equal(displayReferenceAmount(14400, 'BRL', 'EUR'), 24.48);
    assert.equal(displayReferenceAmount(14400, 'BRL', 'USD'), 28.80);
    assert.equal(displayReferenceAmount(12345, 'EUR', 'EUR'), 123.45);
  });
  it('submits edited display amounts in the request source currency', () => {
    assert.equal(referenceAmountToCents('25.50', 'EUR', 'BRL'), 15000);
    assert.equal(referenceAmountToCents('30.00', 'USD', 'BRL'), 15000);
    assert.equal(referenceAmountToCents('20', 'USD', 'EUR'), 1700);
    assert.equal(referenceAmountToCents('17', 'EUR', 'USD'), 2000);
    assert.equal(referenceAmountToCents('12.34', 'USD', 'USD'), 1234);
  });
  it('rounds display amounts and API cents independently', () => {
    assert.equal(displayReferenceAmount(10003, 'BRL', 'EUR'), 17.01);
    assert.equal(referenceAmountToCents('17.01', 'EUR', 'BRL'), 10006);
    assert.equal(referenceAmountToCents('0.17', 'EUR', 'BRL'), 100);
    assert.equal(referenceAmountToCents('0.20', 'USD', 'BRL'), 100);
  });
  it('leaves non-finite values detectable by form validation', () => {
    assert.ok(Number.isNaN(referenceAmountToCents('', 'EUR', 'BRL')));
    assert.ok(Number.isNaN(referenceAmountToCents('  ', 'USD', 'BRL')));
    assert.ok(Number.isNaN(referenceAmountToCents('not an amount', 'USD', 'EUR')));
    assert.equal(referenceAmountToCents('Infinity', 'USD', 'BRL'), Infinity);
    assert.equal(referenceAmountToCents('-10', 'EUR', 'BRL'), -5882);
    assert.ok(Number.isNaN(convertReferenceAmount(NaN, 'BRL', 'EUR')));
    assert.equal(convertReferenceAmount(Infinity, 'BRL', 'USD'), Infinity);
  });
  it('preserves same-currency amounts and reverses all reference pairs', () => {
    const currencies = ['BRL', 'EUR', 'USD'] as const;
    for (const source of currencies) {
      assert.equal(convertReferenceAmount(123.45, source, source), 123.45);
      for (const target of currencies) {
        const converted = convertReferenceAmount(123.45, source, target);
        assert.ok(Math.abs(convertReferenceAmount(converted, target, source) - 123.45) < 1e-10);
      }
    }
  });
});
