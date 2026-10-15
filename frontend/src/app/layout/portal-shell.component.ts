import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  inject,
  signal
} from '@angular/core';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, interval } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { MarketplaceService } from '../core/data-access/marketplace.service';
import { AppNotification } from '../core/models';
import { BrandComponent } from '../shared/components';
import { LocaleControlsComponent } from '../shared/localization/locale-controls.component';
import { LocalizedDatePipe } from '../shared/localization/localized-format.pipe';
import { PortalIcon, PortalNavIconComponent } from './portal-nav-icon.component';

interface NavItem {
  label: string;
  short: string;
  path: string;
  icon: PortalIcon;
}

const NAVIGATION: Record<string, NavItem[]> = {
  customer: [
    { label: 'Visão geral', short: 'Início', path: '/conta', icon: 'home' },
    { label: 'Agendamentos', short: 'Agenda', path: '/conta/agendamentos', icon: 'calendar' },
    { label: 'Mensagens', short: 'Mensagens', path: '/conta/mensagens', icon: 'messages' },
    { label: 'Favoritos', short: 'Favoritos', path: '/conta/favoritos', icon: 'favorites' },
    { label: 'Perfil e preferências', short: 'Perfil', path: '/conta/perfil', icon: 'profile' }
  ],
  provider: [
    { label: 'Visão geral', short: 'Início', path: '/prestador', icon: 'home' },
    { label: 'Solicitações', short: 'Pedidos', path: '/prestador/solicitacoes', icon: 'requests' },
    { label: 'Minha agenda', short: 'Agenda', path: '/prestador/agenda', icon: 'calendar' },
    { label: 'Mensagens', short: 'Mensagens', path: '/prestador/mensagens', icon: 'messages' },
    {
      label: 'Histórico de serviços',
      short: 'Atividade',
      path: '/prestador/atividade',
      icon: 'activity'
    },
    { label: 'Serviços e perfil', short: 'Perfil', path: '/prestador/perfil', icon: 'profile' }
  ],
  admin: [
    { label: 'Visão geral', short: 'Início', path: '/admin', icon: 'home' },
    { label: 'Reservas', short: 'Reservas', path: '/admin/reservas', icon: 'calendar' },
    { label: 'Clientes', short: 'Clientes', path: '/admin/clientes', icon: 'profile' },
    { label: 'Prestadores', short: 'Prestadores', path: '/admin/prestadores', icon: 'profile' },
    { label: 'Catálogo', short: 'Catálogo', path: '/admin/catalogo', icon: 'catalog' },
    { label: 'Site e loja', short: 'Loja', path: '/admin/conteudo', icon: 'catalog' },
    { label: 'Moderação', short: 'Moderação', path: '/admin/suporte', icon: 'moderation' },
    { label: 'Configurações', short: 'Ajustes', path: '/admin/configuracoes', icon: 'settings' }
  ]
};

@Component({
  selector: 'cvp-portal-shell',
  standalone: true,
  imports: [
    BrandComponent,
    LocaleControlsComponent,
    LocalizedDatePipe,
    PortalNavIconComponent,
    RouterLink,
    RouterLinkActive,
    RouterOutlet
  ],
  templateUrl: './portal-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PortalShellComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly marketplace = inject(MarketplaceService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private notificationsRequestActive = false;
  private notificationsInitialized = false;
  private knownNotificationIds = new Set<string>();
  private toastTimer?: ReturnType<typeof setTimeout>;
  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadCount = signal(0);
  readonly notificationsOpen = signal(false);
  readonly notificationsLoading = signal(false);
  readonly notificationsError = signal('');
  readonly latestAlert = signal<AppNotification | null>(null);
  readonly browserNotificationPermission = signal<NotificationPermission | 'unsupported'>(
    this.notificationPermission()
  );
  readonly logoutError = signal('');
  readonly portal = String(this.route.snapshot.data['portal'] ?? 'customer');
  readonly navigation = NAVIGATION[this.portal] ?? NAVIGATION['customer'] ?? [];
  readonly rootPath =
    this.portal === 'provider'
      ? '/prestador'
      : `/${this.portal === 'customer' ? 'conta' : this.portal}`;
  readonly contextLabel =
    this.portal === 'provider'
      ? 'Área do profissional'
      : this.portal === 'admin'
        ? 'Administração'
        : 'Área do cliente';

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      if (this.toastTimer) clearTimeout(this.toastTimer);
    });
    this.loadNotifications();
    if (!this.isBrowser) return;
    interval(15_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (
          this.document.visibilityState === 'visible' ||
          this.browserNotificationPermission() === 'granted'
        )
          this.loadNotifications(true);
      });
    fromEvent(this.document, 'visibilitychange')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.document.visibilityState === 'visible') this.loadNotifications(true);
      });
  }

  toggleNotifications(): void {
    this.notificationsOpen.update((value) => !value);
    if (this.notificationsOpen()) this.loadNotifications(true);
  }
  loadNotifications(silent = false): void {
    if (this.notificationsRequestActive) return;
    this.notificationsRequestActive = true;
    if (!silent) this.notificationsLoading.set(true);
    this.notificationsError.set('');
    this.marketplace.notifications({ perPage: 20 }).subscribe({
      next: (response) => {
        const newItems = this.notificationsInitialized
          ? response.data.filter((item) => !item.readAt && !this.knownNotificationIds.has(item.id))
          : [];
        this.notifications.set(response.data);
        this.unreadCount.set(Number(response.meta?.['unreadCount']) || 0);
        this.knownNotificationIds = new Set(response.data.map((item) => item.id));
        this.notificationsInitialized = true;
        this.notificationsRequestActive = false;
        this.notificationsLoading.set(false);
        if (newItems[0]) this.announceNotification(newItems[0]);
      },
      error: (failure: Error) => {
        this.notificationsRequestActive = false;
        this.notificationsLoading.set(false);
        if (!silent || this.notificationsOpen()) this.notificationsError.set(failure.message);
      }
    });
  }
  openNotification(item: AppNotification): void {
    const openDestination = () => this.navigateFromNotification(item);
    if (item.readAt) {
      openDestination();
      return;
    }
    this.marketplace.readNotification(item.id).subscribe({
      next: () => {
        this.notifications.update((items) =>
          items.map((current) =>
            current.id === item.id ? { ...current, readAt: new Date().toISOString() } : current
          )
        );
        this.unreadCount.update((value) => Math.max(0, value - 1));
        openDestination();
      },
      error: openDestination
    });
  }
  readAll(): void {
    this.marketplace.readAllNotifications().subscribe({
      next: () => {
        this.notifications.update((items) =>
          items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))
        );
        this.unreadCount.set(0);
      }
    });
  }

  async enableBrowserNotifications(): Promise<void> {
    const BrowserNotification = this.document.defaultView?.Notification;
    if (!BrowserNotification) return;
    try {
      this.browserNotificationPermission.set(await BrowserNotification.requestPermission());
    } catch {
      this.browserNotificationPermission.set('denied');
    }
  }

  dismissLatestAlert(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.latestAlert.set(null);
  }

  logout(): void {
    if (this.auth.busy()) return;
    this.logoutError.set('');
    this.auth.logout().subscribe({
      next: () => void this.router.navigateByUrl('/'),
      error: (failure: Error) =>
        this.logoutError.set(
          failure.message || 'Não foi possível encerrar sua sessão. Tente novamente.'
        )
    });
  }

  private navigateFromNotification(item: AppNotification): void {
    this.notificationsOpen.set(false);
    this.dismissLatestAlert();
    const value = (key: string) =>
      typeof item.data?.[key] === 'string' ? (item.data[key] as string) : '';
    const conversationId = value('conversationId');
    if (conversationId && this.portal !== 'admin') {
      void this.router.navigate(
        [this.portal === 'provider' ? '/prestador/mensagens' : '/conta/mensagens'],
        { queryParams: { conversa: conversationId } }
      );
      return;
    }
    const bookingId = value('bookingId');
    if (bookingId) {
      if (this.portal === 'provider' && item.type === 'booking.opportunity') {
        void this.router.navigate(['/prestador/solicitacoes']);
        return;
      }
      void this.router.navigate(
        this.portal === 'customer'
          ? ['/conta/agendamentos', bookingId]
          : [this.portal === 'provider' ? '/prestador/agenda' : '/admin/reservas']
      );
      return;
    }
    if (
      this.portal === 'provider' &&
      ['review.received', 'professional.comment', 'professional.reviewed'].includes(item.type)
    )
      void this.router.navigate(['/prestador/perfil']);
  }

  private announceNotification(item: AppNotification): void {
    this.latestAlert.set(item);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.latestAlert.set(null), 8_000);

    const BrowserNotification = this.document.defaultView?.Notification;
    if (
      !BrowserNotification ||
      BrowserNotification.permission !== 'granted' ||
      this.document.visibilityState === 'visible'
    )
      return;
    try {
      const alert = new BrowserNotification(item.title, { body: item.message, tag: item.id });
      alert.onclick = () => {
        this.document.defaultView?.focus();
        this.openNotification(item);
        alert.close();
      };
    } catch {
      /* Alguns navegadores ou sistemas negam a exibição mesmo após conceder permissão. */
    }
  }

  private notificationPermission(): NotificationPermission | 'unsupported' {
    return this.isBrowser && this.document.defaultView?.Notification
      ? this.document.defaultView.Notification.permission
      : 'unsupported';
  }
}
