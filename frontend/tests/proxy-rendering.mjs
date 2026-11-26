import assert from 'node:assert/strict';
import { assertHomeServiceCard } from './home-service-card.mjs';
import { assertHomeProviderRegistration } from './home-provider-cta.mjs';

const baseUrl = process.env['PREVIEW_URL'] ?? 'http://127.0.0.1:4200';
for (const extraHeaders of [{}, { 'x-forwarded-for': '203.0.113.10', 'x-forwarded-uri': '/spoofed-route' }]) {
  const response = await fetch(`${baseUrl}/`, { headers: { accept: 'text/html', ...extraHeaders } });
  const html = await response.text();
  assert.equal(response.status, 200);
  assertHomeServiceCard(html);
  assertHomeProviderRegistration(html);
  assert.ok(html.includes('ng-server-context="ssr"'), 'The proxy must serve rendered HTML, not the empty CSR shell');
  assert.ok(html.includes('The best solution for your home.'));
  assert.ok(!html.includes('A melhor solução para o seu lar.'));
  assert.ok(html.includes('property="og:locale" content="en_US"'));
  assert.match(html, /property="og:image" content="[^"]*\/images\/profissional-limpeza-hero-887\.webp"/);
  const portraits = Array.from(html.matchAll(/<img\b[^>]*>/g), ([tag]) => tag)
    .filter((tag) => tag.includes('/images/profissional-limpeza-hero-') && tag.includes('srcset='));
  assert.equal(portraits.length, 2);
  for (const attr of ['srcset', 'sizes']) {
    const pattern = new RegExp(`\\b${attr}="([^"]+)"`);
    const firstValue = portraits[0].match(pattern)?.[1];
    assert.ok(firstValue);
    assert.equal(portraits[1].match(pattern)?.[1], firstValue, `Hero layouts must share ${attr}.`);
  }
  if (Object.keys(extraHeaders).length === 0) {
    const assets = Array.from(html.matchAll(/\b(?:src|href)="([^"]+\.(?:js|css))"/g), ([, file]) => file);
    for (const ext of ['.css', '.js']) {
      const file = assets.find((asset) => asset.endsWith(ext));
      assert.ok(file, `Expected a ${ext} asset in the rendered home.`);
      const asset = await fetch(new URL(file, baseUrl), { headers: { 'accept-encoding': 'gzip' } });
      assert.equal(asset.status, 200);
      assert.equal(asset.headers.get('content-encoding'), 'gzip');
      assert.match(asset.headers.get('vary') ?? '', /\bAccept-Encoding\b/i);
      await asset.body?.cancel();
    }
  }
  const data = JSON.parse(html.match(/<script[^>]+id="chezvoust-structured-data"[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? 'null');
  assert.equal(data.find(item => item['@type'] === 'WebSite').name, 'ChezVoust Pro');
  assert.equal(data.find(item => item['@type'] === 'Organization').name, 'ChezVoust Pro');
}
const image = await fetch(`${baseUrl}/images/profissional-limpeza-hero-887.webp`);
assert.equal(image.status, 200, 'The current sharing image must be served by the preview.');
assert.match(image.headers.get('content-type') ?? '', /image\/webp/);
const search = await fetch(`${baseUrl}/servicos?q=__metadata_check__`);
assert.equal(search.status, 200);
assert.ok((await search.text()).includes('name="robots" content="noindex, nofollow"'), 'Filtered catalog metadata must survive route-default updates through the proxy.');
console.log('PASS preview proxy: SSR, shared hero sources, compressed assets, metadata and stripped untrusted headers.');
