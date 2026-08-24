import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { ApiClientError } from '../models';
import { SessionStoreService } from './session-store.service';
import { SessionRefreshService } from './session-refresh.service';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionStoreService);
  const router = inject(Router);
  const refresh = inject(SessionRefreshService);
  const accessToken = session.accessToken;
  const apiRequest = request.url.includes('/api/v1/');
  const outgoing = accessToken && apiRequest
    ? request.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
    : request;

  return next(outgoing).pipe(catchError((error: unknown) => {
    const status = error instanceof HttpErrorResponse || error instanceof ApiClientError ? error.status : 0;
    const publicAuthRequest = /\/auth\/(login|refresh|register|password)\b/.test(request.url);
    if (status === 401 && accessToken && !publicAuthRequest) {
      return refresh.refresh().pipe(
        switchMap((renewedToken) => next(request.clone({ setHeaders: { Authorization: `Bearer ${renewedToken}` } }))),
        catchError((refreshError: unknown) => {
          session.clear();
          const returnUrl = router.url && router.url !== '/entrar' ? router.url : undefined;
          void router.navigate(['/entrar'], { queryParams: returnUrl ? { returnUrl } : undefined });
          return throwError(() => refreshError);
        })
      );
    }
    return throwError(() => error);
  }));
};
