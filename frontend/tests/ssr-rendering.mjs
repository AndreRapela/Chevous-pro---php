import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import { assertHomeServiceCard } from './home-service-card.mjs';
import { assertHomeProviderCta } from './home-provider-cta.mjs';

// A local read-only fixture exercises dynamic page SEO without accessing the user's API.
const api = createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  assert.equal(request.method, 'GET', 'SSR fixtures must never receive a write.');
  const categories = [{ id: 'category-test', slug: 'cleaning', name: 'Cleaning', description: 'Home cleaning.', serviceCount: 0 }];
  const service = { id: 'clean-home', categoryId: 'cleaning', slug: 'limpeza-residencial', name: 'Limpeza residencial', description: 'Limpeza completa adaptada ao tamanho da sua casa.', unit: 'serviço', pricingType: 'fixed', priceFromCents: 12000, durationMinutes: 240 };
  const data = path === '/api/v1/categories' ? categories : path === '/api/v1/services/limpeza-residencial' ? service : [];
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ data, meta: { page: 1, perPage: 3, total: 0, lastPage: 1 } }));
});
api.listen(0, '127.0.0.1');
await once(api, 'listening');
const apiPort = api.address().port;

const port = 4311;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['dist/chezvoust-pro/server/server.mjs'], {
  env: {
    ...process.env,
    PORT: String(port),
    SITE_URL: 'https://chezvoust.test',
    SSR_API_URL: `http://127.0.0.1:${apiPort}/api/v1`,
    // A conexão de teste usa loopback, mas o proxy encaminha o domínio público.
    NG_ALLOWED_HOSTS: '127.0.0.1,chezvoust.test',
    NG_TRUST_PROXY_HEADERS: 'x-forwarded-host,x-forwarded-proto'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

const output = [];
server.stdout.on('data', (chunk) => output.push(String(chunk)));
server.stderr.on('data', (chunk) => output.push(String(chunk)));

async function request(path) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      return await fetch(`${baseUrl}${path}`, {
        headers: { 'x-forwarded-host': 'chezvoust.test', 'x-forwarded-proto': 'https' }
      });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Servidor SSR não iniciou. Saída: ${output.join('')}`);
}

try {
  const home = await request('/');
  const homeHtml = await home.text();
  assert.equal(home.status, 200, 'Home SSR deve responder 200.');
  assertHomeServiceCard(homeHtml);
  assertHomeProviderCta(homeHtml);
  assert.equal((homeHtml.match(/<cvp-home-hero\b/g) ?? []).length, 1, 'Only the Home route must render its main banner, exactly once.');
  for (const fragment of [
    'ng-server-context="ssr"',
    'id="chezvoust-structured-data"',
    '<link rel="canonical" href="https://chezvoust.test/">',
    'property="og:title"',
    'SearchAction'
  ]) {
    assert.ok(homeHtml.includes(fragment), `Home SSR não contém ${fragment}.`);
  }
  assert.ok(!homeHtml.includes('ng-event-dispatch-contract'), 'SSR não deve introduzir script inline incompatível com a CSP.');
  assert.ok(homeHtml.includes('property="og:locale" content="en_US"'), 'SSR must advertise the supported English locale, never pt_BR.');
  assert.ok(homeHtml.includes('property="og:site_name" content="ChezVoust Pro"'));
  for (const name of ['property="og:image"', 'name="twitter:image"']) {
    assert.ok(homeHtml.includes(`${name} content="https://chezvoust.test/images/profissional-limpeza-hero-887.webp"`), 'Sharing metadata must use the original green-palette image.');
  }
  assert.ok(homeHtml.includes('The best solution for your home.'), 'SSR must render interface text in English, not wait for client localization.');
  assert.ok(!homeHtml.includes('A melhor solução para o seu lar.'));
  const homeData = JSON.parse(homeHtml.match(/<script[^>]+id="chezvoust-structured-data"[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? 'null');
  assert.equal(homeData.find(item => item['@type'] === 'WebSite').name, 'ChezVoust Pro');
  assert.equal(homeData.find(item => item['@type'] === 'Organization').name, 'ChezVoust Pro');

  const catalog = await request('/servicos');
  const catalogHtml = await catalog.text();
  assert.equal(catalog.status, 200, 'Catálogo SSR deve responder 200.');
  assert.ok(catalogHtml.includes('<title>Home services | Pro</title>'));
  assert.ok(catalogHtml.includes('<link rel="canonical" href="https://chezvoust.test/servicos">'));
  assert.ok(!catalogHtml.includes('<cvp-home-hero'), 'The catalog must not repeat the Home banner.');

  const detail = await request('/servicos/limpeza-residencial');
  const detailHtml = await detail.text();
  assert.equal(detail.status, 200);
  assert.ok(!detailHtml.includes('<cvp-home-hero'), 'Service details must not repeat the Home banner.');
  assert.ok(detailHtml.includes('Home cleaning'), 'The service fixture must render its actual page, not a loading or error state.');
  assert.match(detailHtml, /<img[^>]*src="\/images\/profissional-limpeza-hero-887\.webp"/, 'Service details must retain the professional portrait.');
  assert.ok(detailHtml.includes('service-detail-copy'), 'Service details must include their own green copy panel.');
  assert.equal((detailHtml.match(/class="service-hero-orb service-hero-orb-/g) ?? []).length, 4, 'Service details must render the four Home-style decorations without repeating the Home banner.');

  for (const path of ['/profissionais', '/produtos', '/ajuda']) {
    const page = await request(path);
    assert.equal(page.status, 200);
    assert.ok(!(await page.text()).includes('<cvp-home-hero'), `${path} must not repeat the Home banner.`);
  }

  const category = await request('/servicos/categoria/cleaning');
  const categoryHtml = await category.text();
  assert.equal(category.status, 200);
  assert.ok(categoryHtml.includes('<title>Cleaning | Pro</title>'), 'Loaded category metadata must survive the route-default update.');
  assert.ok(categoryHtml.includes('<link rel="canonical" href="https://chezvoust.test/servicos/categoria/cleaning">'));
  assert.ok(categoryHtml.includes('"@type":"CollectionPage"'));

  const search = await request('/servicos?q=cleaning');
  const searchHtml = await search.text();
  assert.equal(search.status, 200);
  assert.ok(searchHtml.includes('name="robots" content="noindex, nofollow"'), 'Route defaults must not erase filtered catalog noindex.');

  const privatePage = await request('/entrar');
  assert.equal(privatePage.headers.get('x-robots-tag'), 'noindex, nofollow', 'Autenticação não pode ser indexada.');

  const missing = await request('/endereco-inexistente');
  assert.equal(missing.status, 404, 'Rota desconhecida deve responder 404, não a SPA com 200.');

  const poisonedHost = await new Promise((resolve, reject) => {
    const client = httpRequest({ host: '127.0.0.1', port, path: '/', headers: { Host: 'atacante.example' } }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    client.once('error', reject);
    client.end();
  });
  assert.equal(poisonedHost, 421, 'SSR deve rejeitar hosts que não pertencem à aplicação.');

  console.log('PASS SSR: Home-only banner, service portrait, English rendering, dynamic category/search metadata, current brand, noindex and 404.');
} finally {
  server.kill();
  await once(server, 'exit');
  await new Promise((resolve, reject) => api.close(error => error ? reject(error) : resolve()));
}
