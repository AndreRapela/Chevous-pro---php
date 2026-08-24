import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { BookingStatus, DashboardMetric } from '../../../../core/models';
import { MetricGridComponent, PageHeaderComponent, StatePanelComponent, StatusPillComponent } from '../../../../shared/components';

@Component({
  selector: 'cvp-admin-dashboard',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, MetricGridComponent, PageHeaderComponent, RouterLink, StatePanelComponent, StatusPillComponent],
  template: `
    <section class="portal-page">
      <cvp-page-header eyebrow="Centro de operações" title="Visão geral" description="Indicadores e reservas recentes retornados pela API."><span class="last-updated"><span class="status-dot"></span> Atualizado agora</span></cvp-page-header>
      @if (loading()) { <cvp-state-panel kind="loading" /> }
      @else if (error()) { <cvp-state-panel kind="error" title="Indicadores indisponíveis" [message]="error()" (retry)="load()" /> }
      @else {
        <cvp-metric-grid [metrics]="metrics()" />
        <section class="portal-card"><div class="card-title-row"><h2>Reservas recentes</h2><a class="text-link" routerLink="/admin/reservas">Ver todas</a></div>
          @if (recent().length) { <div class="table-wrap"><table><thead><tr><th>Serviço</th><th>Cliente / profissional</th><th>Status</th><th>Valor</th><th>Criação</th></tr></thead><tbody>@for (item of recent(); track value(item, 'id')) { <tr><td><strong>{{ value(item, 'serviceName') }}</strong></td><td>{{ value(item, 'customerName') }} / {{ value(item, 'professionalName', 'A definir') }}</td><td><cvp-status-pill [status]="bookingStatus(item)" /></td><td>{{ number(item, 'totalCents') / 100 | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</td><td>{{ utcDate(item, 'createdAt') | date:'dd/MM/yyyy HH:mm':'':'pt-BR' }}</td></tr> }</tbody></table></div> }
          @else { <cvp-state-panel kind="empty" title="Sem atividade recente" message="As reservas recentes aparecerão aqui." /> }
        </section>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashboardComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  readonly metrics = signal<DashboardMetric[]>([]);
  readonly recent = signal<Record<string, unknown>[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.marketplace.adminDashboard().subscribe({
      next: (dashboard) => {
        this.metrics.set(this.marketplace.dashboardMetricsFor('admin', dashboard));
        this.recent.set(Array.isArray(dashboard['recentBookings']) ? dashboard['recentBookings'] as Record<string, unknown>[] : []);
        this.loading.set(false);
      },
      error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); }
    });
  }

  value(item: Record<string, unknown>, key: string, fallback = '—'): string {
    const value = item[key];
    return typeof value === 'string' && value ? value : fallback;
  }

  number(item: Record<string, unknown>, key: string): number {
    const value = Number(item[key]);
    return Number.isFinite(value) ? value : 0;
  }

  utcDate(item: Record<string, unknown>, key: string): string {
    const value = this.value(item, key, '');
    return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(' ', 'T')}Z` : value;
  }

  bookingStatus(item: Record<string, unknown>): BookingStatus {
    const status = this.value(item, 'status', 'awaiting_confirmation') as BookingStatus;
    return ['open', 'awaiting_payment', 'awaiting_confirmation', 'confirmed', 'provider_on_the_way', 'in_progress', 'completed', 'cancelled', 'disputed', 'refunded'].includes(status) ? status : 'awaiting_confirmation';
  }
}
