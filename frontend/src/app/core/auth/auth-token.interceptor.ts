import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { ApiClientError } from '../models';
import { SessionStoreService } from './session-store.service';
import { SessionRefreshService } from './session-refresh.service';
import { API_BASE_URL } from '../http/api-base-url.token';
import { isApiUrl } from '../http/api-url.util';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionStoreService);
  const router = inject(Router);
  const refresh = inject(SessionRefreshService);
  const accessToken = session.accessToken;
  const document = inject(DOCUMENT);
  const apiRequest = isApiUrl(
    request.url,
    inject(API_BASE_URL),
    document.location?.href ?? 'http://localhost/'
  );
  if (!apiRequest) return next(request);
  const outgoing =
    accessToken && apiRequest
      ? request.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
      : request;

  const rejectSession = (error: unknown) => {
    session.clear();
    const returnUrl = router.url && router.url !== '/entrar' ? router.url : undefined;
    void router.navigate(['/entrar'], { queryParams: returnUrl ? { returnUrl } : undefined });
    return throwError(() => error);
  };
  const statusOf = (error: unknown) =>
    error instanceof HttpErrorResponse || error instanceof ApiClientError ? error.status : 0;

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      const status =
        error instanceof HttpErrorResponse || error instanceof ApiClientError ? error.status : 0;
      const publicAuthRequest = /\/auth\/(login|refresh|register|password)\b/.test(request.url);
      if (status === 401 && accessToken && !publicAuthRequest) {
        return refresh.refresh().pipe(
          catchError((refreshError: unknown) => {
            return [401, 403].includes(statusOf(refreshError))
              ? rejectSession(refreshError)
              : throwError(() => refreshError);
          }),
          switchMap((renewedToken) =>
            next(request.clone({ setHeaders: { Authorization: `Bearer ${renewedToken}` } })).pipe(
              catchError((retryError: unknown) =>
                statusOf(retryError) === 401
                  ? rejectSession(retryError)
                  : throwError(() => retryError)
              )
            )
          )
        );
      }
      return throwError(() => error);
    })
  );
};
