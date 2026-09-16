import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { User, UserRole } from '../models';

const LEGACY_ACCESS_TOKEN_KEY = 'cvp_access_token';
const LEGACY_REFRESH_TOKEN_KEY = 'cvp_refresh_token';
const LEGACY_USER_KEY = 'cvp_user';
const SESSION_HINT_KEY = 'cvp_has_session';
const ROLES: readonly UserRole[] = ['customer', 'provider', 'admin'];

@Injectable({ providedIn: 'root' })
export class SessionStoreService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly currentUser = signal<User | null>(null);
  private accessTokenValue: string | null = null;
  readonly user = this.currentUser.asReadonly();

  constructor() {
    // Remove dados deixados por versões antigas. Tokens nunca devem persistir no
    // armazenamento do navegador; a renovação fica restrita ao cookie HttpOnly.
    this.removeLegacyStorage(this.sessionStorage);
    this.removeLegacyStorage(this.localStorage);
  }

  get accessToken(): string | null {
    return this.accessTokenValue;
  }

  get hasSessionHint(): boolean {
    return this.readStorage(this.sessionStorage, SESSION_HINT_KEY) === '1' || this.readStorage(this.localStorage, SESSION_HINT_KEY) === '1';
  }

  save(user: User, accessToken: string): void {
    if (!accessToken || !this.isUser(user)) {
      this.clear();
      throw new Error('Sessão inválida recebida do servidor.');
    }

    this.removeStorage(this.sessionStorage, SESSION_HINT_KEY);
    this.removeStorage(this.localStorage, SESSION_HINT_KEY);
    // O indicador não contém credencial. Mantê-lo entre abas permite recuperar
    // o cookie de sessão ao abrir uma nova aba; após fechar o navegador, um
    // cookie sem "manter acesso" deixa de existir e este indicador é limpo.
    this.writeStorage(this.localStorage, SESSION_HINT_KEY, '1');
    this.accessTokenValue = accessToken;
    this.currentUser.set(user);
  }

  updateUser(user: User): void {
    if (!this.isUser(user) || !this.accessToken) {
      this.clear();
      return;
    }
    this.currentUser.set(user);
  }

  replaceAccessToken(accessToken: string, user?: User): void {
    const current = user ?? this.currentUser();
    if (!accessToken || !current || !this.isUser(current)) {
      this.clear();
      throw new Error('Não foi possível renovar a sessão.');
    }
    this.accessTokenValue = accessToken;
    this.currentUser.set(current);
  }

  clear(): void {
    this.accessTokenValue = null;
    this.removeStorage(this.sessionStorage, SESSION_HINT_KEY);
    this.removeStorage(this.localStorage, SESSION_HINT_KEY);
    this.removeLegacyStorage(this.sessionStorage);
    this.removeLegacyStorage(this.localStorage);
    this.currentUser.set(null);
  }

  isAllowedRole(value: unknown): value is UserRole {
    return typeof value === 'string' && ROLES.includes(value as UserRole);
  }

  private isUser(value: unknown): value is User {
    if (!value || typeof value !== 'object') return false;
    const user = value as Partial<User>;
    return typeof user.id === 'string' && typeof user.name === 'string' &&
      typeof user.email === 'string' && this.isAllowedRole(user.role);
  }

  private get sessionStorage(): Storage | null {
    return isPlatformBrowser(this.platformId) ? sessionStorage : null;
  }

  private get localStorage(): Storage | null {
    return isPlatformBrowser(this.platformId) ? localStorage : null;
  }

  private removeLegacyStorage(storage: Storage | null): void {
    this.removeStorage(storage, LEGACY_USER_KEY);
    this.removeStorage(storage, LEGACY_ACCESS_TOKEN_KEY);
    this.removeStorage(storage, LEGACY_REFRESH_TOKEN_KEY);
  }

  private readStorage(storage: Storage | null, key: string): string | null {
    if (!storage) return null;
    try { return storage.getItem(key); } catch { return null; }
  }

  private writeStorage(storage: Storage | null, key: string, value: string): void {
    if (!storage) return;
    try { storage.setItem(key, value); } catch { /* storage indisponível */ }
  }

  private removeStorage(storage: Storage | null, key: string): void {
    if (!storage) return;
    try { storage.removeItem(key); } catch { /* storage indisponível */ }
  }
}
