import assert from 'node:assert/strict';

const baseUrl = process.env['PREVIEW_URL'] ?? 'http://127.0.0.1:4200';
for (const extraHeaders of [{}, { 'x-forwarded-for': '203.0.113.10', 'x-forwarded-uri': '/spoofed-route' }]) {
  const response = await fetch(`${baseUrl}/`, { headers: { accept: 'text/html', ...extraHeaders } });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.ok(html.includes('ng-server-context="ssr"'), 'The proxy must serve rendered HTML, not the empty CSR shell');
  assert.ok(html.includes('The best solution for your home.'));
  assert.ok(!html.includes('A melhor solução para o seu lar.'));
  assert.ok(html.includes('property="og:locale" content="en_US"'));
  assert.match(html, /property="og:image" content="[^"]*\/images\/profissional-limpeza-hero-warm-887\.jpg"/);
}
const image = await fetch(`${baseUrl}/images/profissional-limpeza-hero-warm-887.jpg`);
assert.equal(image.status, 200, 'The current sharing image must be served by the preview.');
assert.match(image.headers.get('content-type') ?? '', /image\/jpeg/);
console.log('PASS preview proxy: SSR English interface, metadata and stripped untrusted headers.');
