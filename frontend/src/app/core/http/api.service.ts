import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models';
import { MockApiService } from '../testing/mock-api.service';

export type ApiQueryValue = string | number | boolean | undefined;
export type ApiQuery = Record<string, ApiQueryValue>;
export interface ApiRequestOptions { headers?: Record<string, string>; }

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly mock = inject(MockApiService);

  get<T>(path: string, query: ApiQuery = {}): Observable<T> {
    return this.request<T>('GET', path, undefined, query);
  }

  getEnvelope<T>(path: string, query: ApiQuery = {}): Observable<ApiEnvelope<T>> {
    return this.requestEnvelope<T>('GET', path, undefined, query);
  }

  post<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Observable<T> {
    return this.request<T>('POST', path, body, {}, options);
  }

  put<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Observable<T> {
    return this.request<T>('PUT', path, body, {}, options);
  }

  patch<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Observable<T> {
    return this.request<T>('PATCH', path, body, {}, options);
  }

  delete<T = void>(path: string, options: ApiRequestOptions = {}): Observable<T> {
    return this.request<T>('DELETE', path, undefined, {}, options);
  }

  private request<T>(method: string, path: string, body?: unknown, query: ApiQuery = {}, options: ApiRequestOptions = {}): Observable<T> {
    return this.requestEnvelope<T>(method, path, body, query, options).pipe(
      map((envelope) => envelope?.data as T)
    );
  }

  private requestEnvelope<T>(method: string, path: string, body?: unknown, query: ApiQuery = {}, options: ApiRequestOptions = {}): Observable<ApiEnvelope<T>> {
    const cleanPath = path.replace(/^\//, '');
    const source = environment.useMockApi
      ? this.mock.request<T>(method, cleanPath, body, query)
      : this.http.request<ApiEnvelope<T> | null>(method, `${environment.apiUrl}/${cleanPath}`, {
          body,
          params: this.toHttpParams(query),
          headers: new HttpHeaders(options.headers ?? {}),
          withCredentials: true
        });

    return source.pipe(map((envelope) => envelope ?? ({ data: undefined as T } as ApiEnvelope<T>)));
  }

  private toHttpParams(query: ApiQuery): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    }
    return params;
  }
}
