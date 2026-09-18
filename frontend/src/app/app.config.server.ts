import { ApplicationConfig, REQUEST, mergeApplicationConfig, inject } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { DOCUMENT } from '@angular/common';
import { BEFORE_APP_SERIALIZED } from '@angular/platform-server';
import { appConfig } from './app.config';
import { API_BASE_URL } from './core/http/api-base-url.token';
import { SERVER_API_HEADERS } from './core/http/server-api-headers.token';
import { SEO_SITE_ORIGIN } from './core/seo/seo-site-origin.token';
import { allowedSeoHosts, resolveSeoOrigin } from './core/seo/seo-origin.util';
import { serverRoutes } from './app.routes.server';
import { LocalizationService } from './core/localization/localization.service';
import { localizeServerContent } from './shared/localization/localized-server-content.util';

function serverLocalization(): () => void {
  const document = inject(DOCUMENT);
  const localization = inject(LocalizationService);
  return () => {
    const root = document.querySelector('.app-root');
    if (root) localizeServerContent(root, (value) => localization.translate(value));
  };
}

function forwardedOrigin(): string {
  const request = inject(REQUEST, { optional: true });
  const host = request?.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    ?? request?.headers.get('host')?.trim();
  const protocol = request?.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  return resolveSeoOrigin(
    process.env['SITE_URL'],
    allowedSeoHosts(process.env['NG_ALLOWED_HOSTS'], process.env['SITE_URL']),
    host,
    protocol
  );
}

function serverApiHeaders(): Readonly<Record<string, string>> {
  const request = inject(REQUEST, { optional: true });
  const clientIp = request?.headers.get('x-client-ip')?.trim() ?? '';
  const proxySecret = process.env['SSR_PROXY_SHARED_SECRET'] ?? '';
  // O valor chega de X-Client-IP, que o Nginx sobrescreve com $remote_addr.
  // Sem ambos, a API usa o IP interno padrão, sem aceitar cabeçalhos forjados.
  return clientIp !== '' && proxySecret !== ''
    ? { 'X-Forwarded-For': clientIp, 'X-Proxy-Secret': proxySecret }
    : {};
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: BEFORE_APP_SERIALIZED, multi: true, useFactory: serverLocalization },
    { provide: API_BASE_URL, useValue: process.env['SSR_API_URL'] ?? 'http://api/api/v1' },
    { provide: SERVER_API_HEADERS, useFactory: serverApiHeaders },
    { provide: SEO_SITE_ORIGIN, useFactory: forwardedOrigin }
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
