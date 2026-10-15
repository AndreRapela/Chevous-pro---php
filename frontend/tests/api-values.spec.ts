import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { apiBoolean } from '../src/app/core/http/api-value.util.ts';
import { compileMembers } from './support/source-harness.ts';

describe('API boolean serialization', () => {
  it('accepts true only in the supported representations', () => {
    for (const value of [true, 1, '1', 'true']) assert.equal(apiBoolean(value), true);
    for (const value of [false, 0, '0', 'false', '', 'yes', null, undefined, {}, []])
      assert.equal(apiBoolean(value), false);
  });
  it('does not turn string zero into a verified or highlighted professional', () => {
    const Harness = compileMembers(
      new URL('../src/app/core/data-access/marketplace-mapper.ts', import.meta.url),
      [
        'providerModel',
        'reviewModel',
        'experienceModel',
        'courseModel',
        'record',
        'string',
        'number',
        'initials',
        'boolean'
      ],
      { apiBoolean }
    );
    const mapper = new Harness();
    const provider = mapper.providerModel({
      id: 'provider',
      name: 'Professional',
      verified: '0',
      featured: '0',
      verificationStatus: 'pending'
    });
    assert.equal(provider.verified, false);
    assert.equal(provider.topProvider, false);
    assert.equal(mapper.providerModel({ verificationStatus: 'approved' }).verified, true);
  });
});
