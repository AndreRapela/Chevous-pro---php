import { ApplicationConfig, LOCALE_ID, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { authTokenInterceptor } from './core/auth/auth-token.interceptor';
import { apiErrorInterceptor } from './core/http/api-error.interceptor';
import { catchError, firstValueFrom, of } from 'rxjs';
import { environment } from '../environments/environment';
import { SessionRefreshService } from './core/auth/session-refresh.service';
import { SessionStoreService } from './core/auth/session-store.service';
import { LocalizationService } from './core/localization/localization.service';
import { provideClientHydration, withNoIncrementalHydration } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection(),
    { provide: LOCALE_ID, useValue: 'en-US' },
    provideAppInitializer(() => inject(LocalizationService).initialize()),
    provideAppInitializer(() => {
      const session = inject(SessionStoreService);
      if (environment.useMockApi || !session.hasSessionHint) return;
      return firstValueFrom(inject(SessionRefreshService).refresh().pipe(
        catchError(() => { session.clear(); return of(null); })
      ));
    }),
    provideHttpClient(withFetch(), withInterceptors([authTokenInterceptor, apiErrorInterceptor])),
    // Não usamos event replay: ele injeta scripts inline, incompatíveis com a
    // CSP estrita que protege a aplicação pública.
    provideClientHydration(withNoIncrementalHydration()),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })
    )
  ]
};
