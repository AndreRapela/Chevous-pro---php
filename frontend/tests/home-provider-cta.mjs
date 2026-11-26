import assert from 'node:assert/strict';

export function assertHomeProviderRegistration(html) {
  assert.doesNotMatch(html, /<section\b[^>]*class="[^"]*home-provider-cta/, 'The professional invitation card must be removed from the home page.');
  const footer = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)?.[1] ?? '';
  assert.match(footer, /<a\b[^>]*href="\/cadastro\?tipo=profissional"/, 'Professional registration must remain available from the public footer.');
}
