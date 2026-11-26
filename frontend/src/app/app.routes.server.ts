import { RenderMode, ServerRoute } from '@angular/ssr';

const privateHeaders = { 'X-Robots-Tag': 'noindex, nofollow' };
const localizedHeaders = { Vary: 'Cookie' };
const tokenPageHeaders = { ...privateHeaders, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };

/**
 * Só o conteúdo público é renderizado no servidor. Painéis e autenticação são
 * deliberadamente client-side e recebem noindex também no cabeçalho HTTP.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server, headers: localizedHeaders },
  { path: 'servicos', renderMode: RenderMode.Server, headers: localizedHeaders },
  { path: 'servicos/categoria/:category', renderMode: RenderMode.Server, headers: localizedHeaders },
  { path: 'servicos/:slug', renderMode: RenderMode.Server, headers: localizedHeaders },
  { path: 'produtos', renderMode: RenderMode.Server, headers: localizedHeaders },
  { path: 'profissionais', renderMode: RenderMode.Server, headers: localizedHeaders },
  { path: 'profissionais/:id/:slug', renderMode: RenderMode.Server, headers: localizedHeaders },
  { path: 'profissionais/:id', renderMode: RenderMode.Server, headers: localizedHeaders },
  { path: 'como-funciona', renderMode: RenderMode.Server, headers: localizedHeaders },
  { path: 'seguranca', renderMode: RenderMode.Server, headers: localizedHeaders },
  { path: 'ajuda', renderMode: RenderMode.Server, headers: localizedHeaders },
  { path: 'termos', renderMode: RenderMode.Server, headers: localizedHeaders },
  { path: 'privacidade', renderMode: RenderMode.Server, headers: localizedHeaders },
  { path: 'entrar', renderMode: RenderMode.Client, headers: privateHeaders },
  { path: 'cadastro', renderMode: RenderMode.Client, headers: privateHeaders },
  { path: 'recuperar-senha', renderMode: RenderMode.Client, headers: privateHeaders },
  { path: 'redefinir-senha', renderMode: RenderMode.Client, headers: tokenPageHeaders },
  { path: 'verificar-email', renderMode: RenderMode.Client, headers: tokenPageHeaders },
  { path: 'agendar/:serviceId', renderMode: RenderMode.Client, headers: privateHeaders },
  { path: 'pagamento/:slug', renderMode: RenderMode.Client, headers: privateHeaders },
  { path: 'conta/**', renderMode: RenderMode.Client, headers: privateHeaders },
  { path: 'prestador/**', renderMode: RenderMode.Client, headers: privateHeaders },
  { path: 'admin/**', renderMode: RenderMode.Client, headers: privateHeaders },
  { path: '**', renderMode: RenderMode.Server, status: 404, headers: { ...privateHeaders, ...localizedHeaders } }
];
