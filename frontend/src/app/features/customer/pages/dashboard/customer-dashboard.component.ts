import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Booking, DashboardMetric } from '../../../../core/models';
import { DateLineComponent, MetricGridComponent, PageHeaderComponent, StatePanelComponent, StatusPillComponent } from '../../../../shared/components';
import { LocalizedDatePipe, LocalizedMoneyPipe } from '../../../../shared/localization/localized-format.pipe';

@Component({
  selector: 'cvp-customer-dashboard',
  standalone: true,
  imports: [LocalizedDatePipe, LocalizedMoneyPipe, DateLineComponent, MetricGridComponent, PageHeaderComponent, RouterLink, StatePanelComponent, StatusPillComponent],
  template: `
    <section class="portal-page customer-dashboard-page">
      <cvp-page-header
        eyebrow="Seu painel"
        [title]="'Olá, ' + (auth.user()?.name?.split(' ')?.[0] ?? '') + '!'"
        description="Veja o que está acontecendo com seus serviços."
      >
        <a class="btn btn-primary" routerLink="/servicos">+ Novo serviço</a>
      </cvp-page-header>
      @if (loading()) {
        <cvp-state-panel kind="loading" />
      } @else if (error()) {
        <cvp-state-panel kind="error" title="Seu painel não carregou" [message]="error()" (retry)="load()" />
      } @else {
        <cvp-metric-grid [metrics]="metrics()" />
        <div class="dashboard-grid">
          <section class="portal-card span-two dashboard-next-card">
            <div class="card-title-row"><div><span class="eyebrow">Próximo compromisso</span><h2>Seu próximo serviço</h2></div><a class="text-link" routerLink="/conta/agendamentos">Ver todos</a></div>
            @if (nextBooking(); as booking) {
              <article class="next-booking">
                <div class="date-tile"><strong>{{ booking.scheduledAt | appDate:'dd' }}</strong><span>{{ booking.scheduledAt | appDate:'MMM' }}</span></div>
                <div class="next-booking-main"><cvp-status-pill [status]="booking.status" /><h3>{{ booking.service.name }}</h3><p><cvp-date-line [value]="booking.scheduledAt" /> · {{ booking.addressLabel }}</p><div class="person-line"><span class="avatar avatar-sm">{{ booking.provider.initials }}</span><span>com <strong>{{ booking.provider.name }}</strong></span></div></div>
                <div class="next-booking-actions">@if (booking.canMessage && booking.conversationId) { <a class="btn btn-secondary btn-small" routerLink="/conta/mensagens" [queryParams]="{ conversa: booking.conversationId }">Mensagem</a> }<a class="btn btn-primary btn-small" [routerLink]="['/conta/agendamentos', booking.id]">Detalhes</a></div>
              </article>
            } @else {
              <div class="dashboard-empty-booking"><span class="empty-service-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M8.5 14.5a6 6 0 1 1 7 0c-1 .7-1.5 1.5-1.5 2.5h-4c0-1-.5-1.8-1.5-2.5Z"/></svg></span><div><strong>Nenhum serviço agendado</strong><small>Encontre o profissional certo para cuidar da sua próxima tarefa.</small></div><a class="btn btn-primary btn-small" routerLink="/servicos">Encontrar serviço</a></div>
            }
          </section>
          <aside class="portal-card dashboard-shortcuts">
            <div class="card-title-row"><h2>Atalhos</h2><small>O que você precisa?</small></div>
            <nav class="shortcut-list" aria-label="Atalhos">
              <a routerLink="/servicos"><span class="shortcut-action-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg></span><span><strong>Buscar</strong><small>Serviços</small></span><i>→</i></a>
              <a routerLink="/conta/agendamentos"><span class="shortcut-action-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6"/></svg></span><span><strong>Agenda</strong><small>Reservas</small></span><i>→</i></a>
              <a routerLink="/conta/mensagens"><span class="shortcut-action-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/></svg></span><span><strong>Mensagens</strong><small>Conversas</small></span><i>→</i></a>
              <a routerLink="/conta/perfil"><span class="shortcut-action-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span><span><strong>Endereços</strong><small>Locais</small></span><i>→</i></a>
            </nav>
          </aside>
        </div>
        <section class="portal-card">
          <div class="card-title-row"><div><span class="eyebrow">Histórico</span><h2>Atividade recente</h2></div></div>
          <div class="table-wrap"><table><thead><tr><th>Serviço</th><th>Profissional</th><th>Data</th><th>Status</th><th>Valor</th></tr></thead><tbody>@for (booking of bookings(); track booking.id) { <tr><td><strong>{{ booking.service.name }}</strong><small>{{ booking.code }}</small></td><td>{{ booking.provider.name }}</td><td>{{ booking.scheduledAt | appDate:'MMM d, yyyy, HH:mm' }}</td><td><cvp-status-pill [status]="booking.status" /></td><td>{{ booking.price.totalCents / 100 | appMoney:booking.price.currency }}</td></tr> }</tbody></table></div>
        </section>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerDashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly marketplace = inject(MarketplaceService);
  readonly bookings = signal<Booking[]>([]);
  readonly metrics = computed<DashboardMetric[]>(() => this.marketplace.customerMetrics(this.bookings()));
  readonly loading = signal(true);
  readonly error = signal('');
  readonly nextBooking = computed(() => this.bookings().filter((item) => ['confirmed', 'awaiting_confirmation'].includes(item.status) && Date.parse(item.scheduledAt) >= Date.now()).sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))[0]);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.marketplace.bookings().subscribe({
      next: (bookings) => {
        this.bookings.set(bookings);
        this.loading.set(false);
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.loading.set(false);
      }
    });
  }
}
