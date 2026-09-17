import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, map, tap } from 'rxjs';
import { ApiService } from '../http/api.service';
import { AuthSession, AuthSessionInfo, User, UserRole } from '../models';
import { SessionStoreService } from './session-store.service';

export interface LoginPayload { email: string; password: string; remember?: boolean; }
export interface RegisterPayload { name: string; email: string; phone: string; password: string; }
interface RegisterResponse { user: User; message: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStoreService);
  readonly user = this.session.user;
  readonly authenticated = computed(() => !!this.session.user() && !!this.session.accessToken);
  readonly busy = signal(false);

  login(payload: LoginPayload): Observable<User> {
    this.busy.set(true);
    const { remember, ...credentials } = payload;
    return this.api.post<AuthSession>('auth/login', { ...credentials, remember: !!remember }).pipe(
      tap((session) => this.setSession(session)),
      map(() => this.session.user() as User),
      finalize(() => this.busy.set(false))
    );
  }

  register(payload: RegisterPayload, role: Extract<UserRole, 'customer' | 'provider'> = 'customer'): Observable<User> {
    this.busy.set(true);
    return this.api.post<RegisterResponse>(`auth/register/${role}`, payload).pipe(
      map((response) => this.normalizeUser(response.user)),
      finalize(() => this.busy.set(false))
    );
  }

  logout(): void {
    this.api.post<void>('auth/logout', {}).subscribe({ error: () => undefined });
    this.session.clear();
  }

  logoutAll(): Observable<void> {
    return this.api.post<void>('auth/logout-all', {}).pipe(finalize(() => this.session.clear()));
  }

  sessions(): Observable<AuthSessionInfo[]> {
    return this.api.get<AuthSessionInfo[]>('auth/sessions');
  }

  revokeSession(id: string): Observable<void> {
    return this.api.delete<void>(`auth/sessions/${encodeURIComponent(id)}`);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.api.post<unknown>('auth/password/change', { currentPassword, newPassword }).pipe(map(() => undefined));
  }

  forgotPassword(email: string): Observable<void> {
    return this.api.post<unknown>('auth/password/forgot', { email }).pipe(map(() => undefined));
  }

  resetPassword(token: string, password: string): Observable<void> {
    return this.api.post<unknown>('auth/password/reset', { token, password }).pipe(map(() => undefined));
  }

  verifyEmail(token: string): Observable<void> {
    return this.api.post<unknown>('auth/email/verify', { token }).pipe(map(() => undefined));
  }

  updateProfile(payload: Partial<Pick<User, 'name' | 'phone'>>): Observable<User> {
    return this.api.patch<User>('me', payload).pipe(
      map((user) => this.normalizeUser(user)),
      tap((user) => this.session.updateUser(user))
    );
  }

  uploadAvatar(file: File): Observable<User> {
    const form = new FormData();
    form.append('avatar', file, file.name);
    return this.api.upload<User>('me/avatar', form).pipe(
      map((user) => this.normalizeUser(user)),
      tap((user) => this.session.updateUser(user))
    );
  }

  homeFor(user: User | null = this.session.user()): string {
    if (user?.role === 'provider') return '/prestador';
    if (user?.role === 'admin') return '/admin';
    return '/conta';
  }

  accessToken(): string | null { return this.session.accessToken; }

  private setSession(session: AuthSession): void {
    const user = this.normalizeUser(session.user);
    this.session.save(user, session.accessToken);
  }

  private normalizeUser(raw: User): User {
    const candidate = String(raw.role) === 'professional' ? 'provider' : raw.role;
    if (!this.session.isAllowedRole(candidate)) {
      this.session.clear();
      throw new Error('Papel de usuário inválido.');
    }
    const initials = raw.initials || raw.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
    return { ...raw, role: candidate, initials, city: raw.city || '' };
  }
}
