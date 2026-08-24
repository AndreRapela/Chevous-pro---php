import { Injectable, signal } from '@angular/core';
import { User, UserRole } from '../models';

export const ACCESS_TOKEN_KEY = 'cvp_access_token';
export const REFRESH_TOKEN_KEY = 'cvp_refresh_token';
export const USER_KEY = 'cvp_user';

const ROLES: readonly UserRole[] = ['customer', 'provider', 'admin'];

@Injectable({ providedIn: 'root' })
export class SessionStoreService {
  private readonly currentUser = signal<User | null>(null);
  readonly user = this.currentUser.asReadonly();

  constructor() {
    const restored = this.restore();
    if (restored) this.currentUser.set(restored);
  }

  get accessToken(): string | null {
    return this.readStorage(sessionStorage, ACCESS_TOKEN_KEY) ?? this.readStorage(localStorage, ACCESS_TOKEN_KEY);
  }

  get remember(): boolean {
    return !!this.readStorage(localStorage, ACCESS_TOKEN_KEY);
  }

  save(user: User, accessToken: string, remember: boolean): void {
    if (!accessToken || !this.isUser(user)) {
      this.clear();
      throw new Error('Sessão inválida recebida do servidor.');
    }

    const target = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    this.clearStorage(other);
    this.writeStorage(target, USER_KEY, JSON.stringify(user));
    this.writeStorage(target, ACCESS_TOKEN_KEY, accessToken);
    // Tokens de renovação antigos não devem permanecer acessíveis ao JavaScript.
    this.removeStorage(target, REFRESH_TOKEN_KEY);
    this.currentUser.set(user);
  }

  updateUser(user: User): void {
    if (!this.isUser(user) || !this.accessToken) {
      this.clear();
      return;
    }
    const target = this.readStorage(sessionStorage, ACCESS_TOKEN_KEY) ? sessionStorage : localStorage;
    this.writeStorage(target, USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  replaceAccessToken(accessToken: string, user?: User): void {
    const current = user ?? this.currentUser();
    if (!accessToken || !current || !this.isUser(current)) {
      this.clear();
      throw new Error('Não foi possível renovar a sessão.');
    }
    this.save(current, accessToken, this.remember);
  }

  clear(): void {
    this.clearStorage(sessionStorage);
    this.clearStorage(localStorage);
    this.currentUser.set(null);
  }

  isAllowedRole(value: unknown): value is UserRole {
    return typeof value === 'string' && ROLES.includes(value as UserRole);
  }

  private restore(): User | null {
    if (!this.accessToken) {
      this.clearStorage(sessionStorage);
      this.clearStorage(localStorage);
      return null;
    }
    try {
      const raw = this.readStorage(sessionStorage, USER_KEY) ?? this.readStorage(localStorage, USER_KEY);
      if (!raw) return null;
      const user = JSON.parse(raw) as unknown;
      if (!this.isUser(user)) throw new Error('invalid-user');
      return user;
    } catch {
      this.clearStorage(sessionStorage);
      this.clearStorage(localStorage);
      return null;
    }
  }

  private isUser(value: unknown): value is User {
    if (!value || typeof value !== 'object') return false;
    const user = value as Partial<User>;
    return typeof user.id === 'string' && typeof user.name === 'string' &&
      typeof user.email === 'string' && this.isAllowedRole(user.role);
  }

  private clearStorage(storage: Storage): void {
    this.removeStorage(storage, USER_KEY);
    this.removeStorage(storage, ACCESS_TOKEN_KEY);
    this.removeStorage(storage, REFRESH_TOKEN_KEY);
  }

  private readStorage(storage: Storage, key: string): string | null {
    try { return storage.getItem(key); } catch { return null; }
  }

  private writeStorage(storage: Storage, key: string, value: string): void {
    try { storage.setItem(key, value); } catch { /* storage indisponível */ }
  }

  private removeStorage(storage: Storage, key: string): void {
    try { storage.removeItem(key); } catch { /* storage indisponível */ }
  }
}
