import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { DashboardMetric, ProviderJob, ProviderRequest } from '../../../../core/models';
import { MetricGridComponent, PageHeaderComponent, StatePanelComponent, StatusPillComponent } from '../../../../shared/components';

@Component({
  selector: 'cvp-provider-dashboard',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, MetricGridComponent, PageHeaderComponent, RouterLink, StatePanelComponent, StatusPillComponent],
  template: `
    <section class="portal-page provider-dashboard-page">
      <cvp-page-header eyebrow="Área profissional" [title]="'Olá, ' + (auth.user()?.name?.split(' ')?.[0] ?? '') + '!'" description="Acompanhe a agenda e as oportunidades disponíveis." />
      @if (loading()) { <cvp-state-panel kind="loading" /> }
      @else if (error()) { <cvp-state-panel kind="error" title="Painel indisponível" [message]="error()" (retry)="load()" /> }
      @else {
        <cvp-metric-grid [metrics]="metrics()" />
        <div class="dashboard-grid">
          <section class="portal-card span-two"><div class="card-title-row"><div><span class="eyebrow">Agenda</span><h2>Próximos atendimentos</h2></div><a class="text-link" routerLink="/prestador/agenda">Ver agenda</a></div>
            @if (upcomingJobs().length) { <div class="timeline-list">@for (job of upcomingJobs().slice(0, 4); track job.id) { <article><time>{{ job.scheduledStart | date:'dd/MM HH:mm':'':'pt-BR' }}</time><span class="timeline-dot"></span><div><cvp-status-pill [status]="job.status" /><h3>{{ job.serviceName }}</h3><p>{{ job.customerName }} · {{ job.city }}, {{ job.state }}</p></div>@if (job.conversationId) { <a class="btn btn-secondary btn-small" routerLink="/prestador/mensagens" [queryParams]="{ conversa: job.conversationId }">Mensagem</a> }</article> }</div> }
            @else { <cvp-state-panel kind="empty" title="Agenda livre" message="Seus próximos atendimentos aparecerão aqui." /> }
          </section>
          <aside class="portal-card profile-health"><span class="success-mark small">{{ verificationStatus() === 'approved' ? '✓' : '!' }}</span><h2>{{ verificationTitle() }}</h2><p>{{ verificationDescription() }}</p><a class="btn btn-primary btn-block btn-small" routerLink="/prestador/perfil">Revisar perfil</a></aside>
        </div>
        <section class="portal-card"><div class="card-title-row"><div><span class="eyebrow">Marketplace</span><h2>Novas solicitações</h2></div><a class="text-link" routerLink="/prestador/solicitacoes">Ver todas</a></div>@if (requests()[0]; as request) { <div class="request-preview"><span class="service-symbol">{{ initials(request.serviceName) }}</span><div><strong>{{ request.serviceName }}</strong><p>{{ request.city }}, {{ request.state }} · {{ request.scheduledStart | date:'dd/MM HH:mm':'':'pt-BR' }}</p></div><strong>{{ request.suggestedSubtotalCents / 100 | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong><a class="btn btn-primary btn-small" routerLink="/prestador/solicitacoes">Analisar</a></div> } @else { <p class="muted">Nenhuma solicitação aberta agora.</p> }</section>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProviderDashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly marketplace = inject(MarketplaceService);
  readonly metrics = signal<DashboardMetric[]>([]);
  readonly jobs = signal<ProviderJob[]>([]);
  readonly requests = signal<ProviderRequest[]>([]);
  readonly profile = signal<Record<string, unknown>>({});
  readonly upcomingJobs = computed(() => this.jobs().filter((job) => ['confirmed', 'provider_on_the_way', 'in_progress'].includes(job.status) && Date.parse(job.scheduledStart) >= Date.now()).sort((a, b) => Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart)));
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({ dashboard: this.marketplace.providerDashboard(), jobs: this.marketplace.providerJobs(), profile: this.marketplace.providerProfile() }).pipe(
      switchMap((base) => String(base.profile['verificationStatus']) === 'approved' ? this.marketplace.providerOpenRequests().pipe(switchMap((requests) => of({ ...base, requests }))) : of({ ...base, requests: [] as ProviderRequest[] }))
    ).subscribe({
      next: ({ dashboard, jobs, profile, requests }) => {
        this.metrics.set(this.marketplace.dashboardMetricsFor('provider', dashboard));
        this.jobs.set(jobs);
        this.requests.set(requests);
        this.profile.set(profile);
        this.loading.set(false);
      },
      error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); }
    });
  }

  initials(value: string): string {
    return value.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
  }

  verificationStatus(): string { return String(this.profile()['verificationStatus'] ?? 'pending'); }
  verificationTitle(): string { return ({ approved: 'Perfil aprovado', pending: 'Perfil em análise', rejected: 'Perfil rejeitado', suspended: 'Perfil suspenso' } as Record<string, string>)[this.verificationStatus()] ?? 'Perfil em análise'; }
  verificationDescription(): string { return this.verificationStatus() === 'approved' ? 'O perfil está habilitado para receber oportunidades. Isso não representa certificação de identidade.' : 'Complete seus serviços e disponibilidade enquanto aguarda a análise da equipe.'; }
}
