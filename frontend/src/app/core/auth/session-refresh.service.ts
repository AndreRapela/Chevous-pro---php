import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, finalize, map, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope, AuthSession } from '../models';
import { MockApiService } from '../testing/mock-api.service';
import { SessionStoreService } from './session-store.service';

@Injectable({ providedIn: 'root' })
export class SessionRefreshService {
  private readonly session = inject(SessionStoreService);
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly mock = inject(MockApiService);
  private pending: Observable<string> | null = null;

  refresh(): Observable<string> {
    if (this.pending) return this.pending;
    const source = environment.useMockApi
      ? this.mock.request<AuthSession>('POST', 'auth/refresh', {})
      : this.http.post<ApiEnvelope<AuthSession>>(`${environment.apiUrl}/auth/refresh`, {}, { withCredentials: true });
    this.pending = source.pipe(
      map((response) => response.data),
      tap((response) => {
        const current = this.session.user();
        const name = response.user.name || current?.name || '';
        const user = { ...current, ...response.user, initials: response.user.initials || current?.initials || name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join(''), city: response.user.city || current?.city || '' };
        this.session.replaceAccessToken(response.accessToken, user);
      }),
      map((response) => response.accessToken),
      finalize(() => this.pending = null),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.pending;
  }
}
