import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeProviderServicePrices } from '../src/app/shared/utils/provider-service.util.ts';

describe('provider service price responses', () => {
  it('uses catalog prices when the nullable override is absent', () => {
    for (const customPriceCents of [null, undefined, '']) {
      const input = { id: 'service-test', catalogPriceCents: '10003', customPriceCents, active: true };
      assert.deepEqual(normalizeProviderServicePrices(input), { ...input, catalogPriceCents: 10003, customPriceCents: 10003 });
      assert.equal(input.catalogPriceCents, '10003', 'Normalization must not mutate the API object.');
    }
    assert.equal(normalizeProviderServicePrices({ catalogPriceCents: 14400 }).customPriceCents, 14400);
  });
  it('normalizes string numbers without discarding explicit zero or active state', () => {
    assert.deepEqual(normalizeProviderServicePrices({ catalogPriceCents: '14400', customPriceCents: '15000', active: false }), { catalogPriceCents: 14400, customPriceCents: 15000, active: false });
    assert.equal(normalizeProviderServicePrices({ catalogPriceCents: 14400, customPriceCents: 0 }).customPriceCents, 0);
  });
  it('keeps invalid numeric responses detectable or falls back to the catalog', () => {
    for (const customPriceCents of ['invalid', NaN, Infinity]) {
      assert.equal(normalizeProviderServicePrices({ catalogPriceCents: 14400, customPriceCents }).customPriceCents, 14400);
    }
    assert.deepEqual(normalizeProviderServicePrices({ catalogPriceCents: 'invalid', customPriceCents: null }), { catalogPriceCents: 0, customPriceCents: 0 });
  });
});
