import { RenderMode, ServerRoute } from '@angular/ssr';

const privateHeaders = { 'X-Robots-Tag': 'noindex, nofollow' };

/**
 * Só o conteúdo público é renderizado no servidor. Painéis e autenticação são
 * deliberadamente client-side e recebem noindex também no cabeçalho HTTP.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
  { path: 'servicos', renderMode: RenderMode.Server },
  { path: 'servicos/categoria/:category', renderMode: RenderMode.Server },
  { path: 'servicos/:slug', renderMode: RenderMode.Server },
  { path: 'profissionais', renderMode: RenderMode.Server },
  { path: 'profissionais/:id/:slug', renderMode: RenderMode.Server },
  { path: 'profissionais/:id', renderMode: RenderMode.Server },
  { path: 'como-funciona', renderMode: RenderMode.Server },
  { path: 'seguranca', renderMode: RenderMode.Server },
  { path: 'ajuda', renderMode: RenderMode.Server },
  { path: 'termos', renderMode: RenderMode.Server },
  { path: 'privacidade', renderMode: RenderMode.Server },
  { path: 'entrar', renderMode: RenderMode.Client, headers: privateHeaders },
  { path: 'cadastro', renderMode: RenderMode.Client, headers: privateHeaders },
  { path: 'recuperar-senha', renderMode: RenderMode.Client, headers: privateHeaders },
  { path: 'redefinir-senha', renderMode: RenderMode.Client, headers: privateHeaders },
  { path: 'verificar-email', renderMode: RenderMode.Client, headers: privateHeaders },
  { path: 'agendar/:serviceId', renderMode: RenderMode.Client, headers: privateHeaders },
  { path: 'conta/**', renderMode: RenderMode.Client, headers: privateHeaders },
  { path: 'prestador/**', renderMode: RenderMode.Client, headers: privateHeaders },
  { path: 'admin/**', renderMode: RenderMode.Client, headers: privateHeaders },
  { path: '**', renderMode: RenderMode.Server, status: 404, headers: privateHeaders }
];
