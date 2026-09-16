import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { allowedSeoHosts, isAllowedSeoHost } from './app/core/seo/seo-origin.util';

const browserDistFolder = join(import.meta.dirname, '../browser');
const app = express();
const angularApp = new AngularNodeAppEngine();
const allowedHosts = allowedSeoHosts(process.env['NG_ALLOWED_HOSTS'], process.env['SITE_URL']);

// O Angular recebe os cabeçalhos do Nginx diretamente. Não habilitar trust
// proxy global evita que um cabeçalho do cliente altere o contexto Express.
app.set('trust proxy', false);
app.use((req, res, next) => {
  // Em produção, falhar fechado. Em desenvolvimento sem configuração explícita
  // o servidor continua utilizável, mas nunca cria SEO canônico a partir do host.
  if (allowedHosts.size > 0 && !isAllowedSeoHost(req.headers.host, allowedHosts)) {
    res.status(421).type('text/plain').send('Host não permitido.');
    return;
  }
  next();
});
app.use(express.static(browserDistFolder, { maxAge: '1y', index: false, redirect: false }));

app.use((req, res, next) => {
  angularApp.handle(req)
    .then((response) => response ? writeResponseToNodeResponse(response, res) : next())
    .catch(next);
});

if (isMainModule(import.meta.url)) {
  const port = Number(process.env['PORT'] ?? 4000);
  app.listen(port, '0.0.0.0', () => {
    console.info(`ChezVoust Pro SSR listening on http://0.0.0.0:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
