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
  const data = JSON.parse(html.match(/<script[^>]+id="chezvoust-structured-data"[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? 'null');
  assert.equal(data.find(item => item['@type'] === 'WebSite').name, 'ChezVoust Pro');
  assert.equal(data.find(item => item['@type'] === 'Organization').name, 'ChezVoust Pro');
}
const image = await fetch(`${baseUrl}/images/profissional-limpeza-hero-warm-887.jpg`);
assert.equal(image.status, 200, 'The current sharing image must be served by the preview.');
assert.match(image.headers.get('content-type') ?? '', /image\/jpeg/);
const search = await fetch(`${baseUrl}/servicos?q=__metadata_check__`);
assert.equal(search.status, 200);
assert.ok((await search.text()).includes('name="robots" content="noindex, nofollow"'), 'Filtered catalog metadata must survive route-default updates through the proxy.');
console.log('PASS preview proxy: SSR English interface, metadata and stripped untrusted headers.');
