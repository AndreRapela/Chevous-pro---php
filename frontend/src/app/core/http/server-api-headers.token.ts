import { InjectionToken } from '@angular/core';

/** Cabeçalhos internos adicionados exclusivamente pelo processo SSR. */
export const SERVER_API_HEADERS = new InjectionToken<Readonly<Record<string, string>>>('SERVER_API_HEADERS', {
  providedIn: 'root',
  factory: () => ({})
});
