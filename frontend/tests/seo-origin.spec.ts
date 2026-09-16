import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allowedSeoHosts, isAllowedSeoHost, resolveSeoOrigin } from '../src/app/core/seo/seo-origin.util.ts';

describe('origem SEO no SSR', () => {
  it('prioriza a origem pública configurada e não o host encaminhado', () => {
    const allowed = allowedSeoHosts('chezvoust.test', 'https://chezvoust.test');
    assert.equal(resolveSeoOrigin('https://chezvoust.test', allowed, 'atacante.example', 'https'), 'https://chezvoust.test');
  });

  it('aceita apenas hosts explicitamente permitidos quando não há SITE_URL', () => {
    const allowed = allowedSeoHosts('localhost,chezvoust.test', undefined);
    assert.equal(isAllowedSeoHost('chezvoust.test:443', allowed), true);
    assert.equal(isAllowedSeoHost('atacante.example', allowed), false);
    assert.equal(resolveSeoOrigin(undefined, allowed, 'atacante.example', 'https'), '');
  });
});
