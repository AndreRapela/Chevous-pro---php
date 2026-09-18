import assert from 'node:assert/strict';

export function assertHomeProviderCta(html) {
  const section = html.match(/<section\b[^>]*class="[^"]*home-provider-cta[^"]*"[^>]*>([\s\S]*?)<\/section>/);
  assert.ok(section, 'Home must retain its professional invitation section.');
  assert.match(section[0], /aria-labelledby="provider-cta-title"/);
  assert.match(section[1], /<h2\b[^>]*id="provider-cta-title"[^>]*>Offer your services on your terms\.<\/h2>/);
  assert.ok(section[1].includes('Set your availability'));
  assert.ok(section[1].includes('Choose your opportunities'));
  assert.equal([...section[1].matchAll(/<b\b[^>]*aria-hidden="true"[^>]*>✓<\/b>/g)].length, 2);
  assert.match(section[1], /<a\b[^>]*href="\/cadastro\?tipo=profissional"[^>]*>Become a professional<\/a>/);
}
