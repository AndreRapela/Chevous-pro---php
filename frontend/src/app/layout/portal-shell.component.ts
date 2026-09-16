import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { MarketplaceService } from '../core/data-access/marketplace.service';
import { AppNotification } from '../core/models';
import { BrandComponent } from '../shared/components';
import { LocaleControlsComponent } from '../shared/localization/locale-controls.component';
import { LocalizedDatePipe } from '../shared/localization/localized-format.pipe';

interface NavItem { label: string; short: string; path: string; symbol: string; }

const NAVIGATION: Record<string, NavItem[]> = {
  customer: [
    { label: 'Visão geral', short: 'Início', path: '/conta', symbol: '⌂' },
    { label: 'Agendamentos', short: 'Agenda', path: '/conta/agendamentos', symbol: '□' },
    { label: 'Mensagens', short: 'Mensagens', path: '/conta/mensagens', symbol: '○' },
    { label: 'Favoritos', short: 'Favoritos', path: '/conta/favoritos', symbol: '♡' },
    { label: 'Perfil e preferências', short: 'Perfil', path: '/conta/perfil', symbol: '◇' }
  ],
  provider: [
    { label: 'Visão geral', short: 'Início', path: '/prestador', symbol: '⌂' },
    { label: 'Solicitações', short: 'Pedidos', path: '/prestador/solicitacoes', symbol: '+' },
    { label: 'Minha agenda', short: 'Agenda', path: '/prestador/agenda', symbol: '□' },
    { label: 'Mensagens', short: 'Mensagens', path: '/prestador/mensagens', symbol: '○' },
    { label: 'Histórico de serviços', short: 'Atividade', path: '/prestador/atividade', symbol: '✓' },
    { label: 'Serviços e perfil', short: 'Perfil', path: '/prestador/perfil', symbol: '◇' }
  ],
  admin: [
    { label: 'Visão geral', short: 'Início', path: '/admin', symbol: '⌂' },
    { label: 'Reservas', short: 'Reservas', path: '/admin/reservas', symbol: '□' },
    { label: 'Clientes', short: 'Clientes', path: '/admin/clientes', symbol: '○' },
    { label: 'Prestadores', short: 'Prestadores', path: '/admin/prestadores', symbol: '◇' },
    { label: 'Catálogo', short: 'Catálogo', path: '/admin/catalogo', symbol: '≡' },
    { label: 'Moderação', short: 'Moderação', path: '/admin/suporte', symbol: '?' },
    { label: 'Configurações', short: 'Ajustes', path: '/admin/configuracoes', symbol: '·' }
  ]
};

@Component({
  selector: 'cvp-portal-shell',
  standalone: true,
  imports: [BrandComponent, LocaleControlsComponent, LocalizedDatePipe, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <a class="skip-link" href="#portal-main">Pular para o conteúdo</a>
    <div class="portal-layout" [class.admin-layout]="portal === 'admin'">
      <aside class="portal-sidebar">
        <cvp-brand />
        <div class="portal-context">{{ contextLabel }}</div>
        <nav aria-label="Navegação do painel">
          @for (item of navigation; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === rootPath }">
              <span aria-hidden="true">{{ item.symbol }}</span>{{ item.label }}
            </a>
          }
        </nav>
        <a class="portal-help" routerLink="/ajuda"><span aria-hidden="true">?</span> Precisa de ajuda?</a>
      </aside>
      <div class="portal-content">
        <header class="portal-header">
          <div><span class="mobile-context">{{ contextLabel }}</span></div>
          <div class="portal-user">
            <div class="notification-center"><button class="icon-button" type="button" [attr.aria-label]="notificationsOpen() ? 'Fechar notificações' : 'Abrir notificações'" [attr.aria-expanded]="notificationsOpen()" aria-controls="notification-panel" (click)="toggleNotifications()"><span aria-hidden="true">!</span>@if (unreadCount()) { <span class="notification-dot"></span> }</button>@if (notificationsOpen()) { <section id="notification-panel" class="notification-panel" aria-label="Notificações"><div class="card-title-row"><h2>Notificações</h2>@if (unreadCount()) { <button class="text-button" type="button" (click)="readAll()">Marcar todas como lidas</button> }</div>@if (notificationsLoading()) { <p class="muted">Carregando…</p> } @else if (notificationsError()) { <p class="field-error" role="alert">{{ notificationsError() }}</p> } @else if (!notifications().length) { <p class="muted">Nenhuma notificação.</p> } @else { <div class="notification-list">@for (item of notifications(); track item.id) { <button type="button" [class.unread]="!item.readAt" (click)="openNotification(item)"><strong>{{ item.title }}</strong><span>{{ item.message }}</span><time>{{ item.createdAt | appDate:'MMM d, HH:mm' }}</time></button> }</div> }</section> }</div>
            <cvp-locale-controls />
            @if (auth.user(); as user) {
              <span class="avatar avatar-sm" aria-hidden="true">{{ user.initials }}</span>
              <span class="portal-user-name">{{ user.name }}</span>
            }
            <button class="btn btn-ghost btn-small" type="button" (click)="logout()">Sair</button>
          </div>
        </header>
        <main id="portal-main" tabindex="-1"><router-outlet /></main>
      </div>
      <nav class="bottom-nav portal-bottom-nav" aria-label="Atalhos do painel">
        @for (item of navigation.slice(0, 4); track item.path) {
          <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === rootPath }"><span class="portal-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24">@if (item.short === 'Início') { <path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/> } @else if (item.short === 'Agenda' || item.short === 'Reservas') { <rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6"/> } @else if (item.short === 'Mensagens') { <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/> } @else if (item.short === 'Favoritos') { <path d="M20.8 5.7a5.5 5.5 0 0 0-7.8 0L12 6.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z"/> } @else if (item.short === 'Pedidos') { <rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 9h8M8 13h8M8 17h5"/> } @else { <circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c0-4 2.5-6 6-6s6 2 6 6M15 15c3 0 5 1.5 5 4"/> }</svg></span><span class="bottom-label">{{ item.short }}</span></a>
        }
        <details class="bottom-more" #moreMenu><summary><span class="portal-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></span><span class="bottom-label">Mais</span></summary><div>@for (item of navigation.slice(4); track item.path) { <a [routerLink]="item.path" routerLinkActive="active" (click)="moreMenu.removeAttribute('open')"><span aria-hidden="true">{{ item.symbol }}</span>{{ item.label }}</a> }</div></details>
      </nav>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PortalShellComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly marketplace = inject(MarketplaceService);
  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadCount = signal(0);
  readonly notificationsOpen = signal(false);
  readonly notificationsLoading = signal(false);
  readonly notificationsError = signal('');
  readonly portal = String(this.route.snapshot.data['portal'] ?? 'customer');
  readonly navigation = NAVIGATION[this.portal] ?? NAVIGATION['customer'] ?? [];
  readonly rootPath = this.portal === 'provider' ? '/prestador' : `/${this.portal === 'customer' ? 'conta' : this.portal}`;
  readonly contextLabel = this.portal === 'provider' ? 'Área do profissional' : this.portal === 'admin' ? 'Administração' : 'Área do cliente';

  ngOnInit(): void { this.loadNotifications(); }

  toggleNotifications(): void { this.notificationsOpen.update((value) => !value); if (this.notificationsOpen()) this.loadNotifications(); }
  loadNotifications(): void {
    this.notificationsLoading.set(true); this.notificationsError.set('');
    this.marketplace.notifications({ perPage: 8 }).subscribe({
      next: (response) => { this.notifications.set(response.data); this.unreadCount.set(Number(response.meta?.['unreadCount']) || 0); this.notificationsLoading.set(false); },
      error: (failure: Error) => { this.notificationsError.set(failure.message); this.notificationsLoading.set(false); }
    });
  }
  openNotification(item: AppNotification): void {
    const openDestination = () => this.navigateFromNotification(item);
    if (item.readAt) { openDestination(); return; }
    this.marketplace.readNotification(item.id).subscribe({
      next: () => {
        this.notifications.update((items) => items.map((current) => current.id === item.id ? { ...current, readAt: new Date().toISOString() } : current));
        this.unreadCount.update((value) => Math.max(0, value - 1));
        openDestination();
      },
      error: openDestination
    });
  }
  readAll(): void { this.marketplace.readAllNotifications().subscribe({ next: () => { this.notifications.update((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))); this.unreadCount.set(0); } }); }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }

  private navigateFromNotification(item: AppNotification): void {
    this.notificationsOpen.set(false);
    const value = (key: string) => typeof item.data?.[key] === 'string' ? item.data[key] as string : '';
    const conversationId = value('conversationId');
    if (conversationId && this.portal !== 'admin') {
      void this.router.navigate([this.portal === 'provider' ? '/prestador/mensagens' : '/conta/mensagens'], { queryParams: { conversa: conversationId } });
      return;
    }
    const bookingId = value('bookingId');
    if (bookingId) {
      void this.router.navigate(this.portal === 'customer' ? ['/conta/agendamentos', bookingId] : [this.portal === 'provider' ? '/prestador/agenda' : '/admin/reservas']);
      return;
    }
    if (this.portal === 'provider' && item.type === 'review.received') void this.router.navigate(['/prestador/perfil']);
  }
}
