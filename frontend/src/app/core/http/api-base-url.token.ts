import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * URL pública no browser e URL interna no processo de SSR. Manter essa escolha
 * em um token impede que a renderização do servidor tente chamar a própria SPA.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl
});
