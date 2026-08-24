import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiClientError, ApiErrorBody } from '../models';

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== 'object' || !('error' in value)) return false;
  const nested = (value as { error?: unknown }).error;
  return !!nested && typeof nested === 'object' && 'code' in nested && 'message' in nested;
}

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(
    catchError((failure: unknown) => {
      if (failure instanceof ApiClientError) return throwError(() => failure);

      if (failure instanceof HttpErrorResponse && isApiErrorBody(failure.error)) {
        const body = failure.error.error;
        return throwError(
          () => new ApiClientError(body.code, body.message, failure.status, body.fields, body.requestId)
        );
      }

      const status = failure instanceof HttpErrorResponse ? failure.status : 0;
      const message = failure instanceof HttpErrorResponse && failure.status > 0
        ? `A solicitação falhou (${failure.status}). Tente novamente.`
        : 'Não foi possível conectar. Verifique sua internet e tente novamente.';
      return throwError(() => new ApiClientError('network_error', message, status));
    })
  );
