import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';

const port = 4311;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['dist/chezvoust-pro/server/server.mjs'], {
  env: {
    ...process.env,
    PORT: String(port),
    SITE_URL: 'https://chezvoust.test',
    SSR_API_URL: 'http://127.0.0.1:9/api/v1',
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

  const catalog = await request('/servicos');
  const catalogHtml = await catalog.text();
  assert.equal(catalog.status, 200, 'Catálogo SSR deve responder 200.');
  assert.ok(catalogHtml.includes('<title>Home services | Pro</title>'));
  assert.ok(catalogHtml.includes('<link rel="canonical" href="https://chezvoust.test/servicos">'));

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

  console.log('PASS SSR: renderização, metadados, noindex e 404.');
} finally {
  server.kill();
  await once(server, 'exit');
}
