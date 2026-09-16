import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { ProviderJob } from '../../../../core/models';
import { PageHeaderComponent, StatePanelComponent, StatusPillComponent } from '../../../../shared/components';
import { LocalizedDatePipe } from '../../../../shared/localization/localized-format.pipe';

@Component({
  selector: 'cvp-provider-activity',
  standalone: true,
  imports: [LocalizedDatePipe, PageHeaderComponent, StatePanelComponent, StatusPillComponent],
  template: `
    <section class="portal-page provider-operations-page provider-earnings-page">
      <cvp-page-header eyebrow="Atividade profissional" title="Histórico de serviços" description="Acompanhe atendimentos, status e clientes sem movimentação financeira pela plataforma." />
      @if (loading()) { <cvp-state-panel kind="loading" /> }
      @else if (error()) { <cvp-state-panel kind="error" title="Resumo indisponível" [message]="error()" (retry)="load()" /> }
      @else {
        <div class="metric-grid"><article class="metric-card metric-brand"><p>Serviços concluídos</p><strong>{{ completedCount() }}</strong><small>atendimentos finalizados</small></article><article class="metric-card metric-amber"><p>Em andamento</p><strong>{{ activeCount() }}</strong><small>atendimentos ativos</small></article></div>
        <section class="portal-card"><div class="card-title-row"><h2>Histórico recente</h2></div><div class="transaction-list">@for (job of jobs(); track job.id) { <article><span class="transaction-symbol">✓</span><div><strong>{{ job.serviceName }}</strong><small>{{ job.scheduledStart | appDate:'MMM d, yyyy' }} · {{ job.customerName }}</small></div><cvp-status-pill [status]="job.status" /></article> } @empty { <p class="muted">Nenhum atendimento registrado ainda.</p> }</div></section>
        <aside class="portal-card"><span class="chip chip-soft">Sem pagamentos</span><h2>Organize sua operação</h2><p class="muted">A plataforma centraliza agenda, comunicação e histórico. A negociação é feita diretamente entre cliente e profissional.</p></aside>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProviderActivityComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  readonly jobs = signal<ProviderJob[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly completedCount = computed(() => this.jobs().filter((job) => job.status === 'completed').length);
  readonly activeCount = computed(() => this.jobs().filter((job) => ['confirmed', 'provider_on_the_way', 'in_progress'].includes(job.status)).length);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.marketplace.providerJobs().subscribe({
      next: (jobs) => { this.jobs.set(jobs); this.loading.set(false); },
      error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); }
    });
  }
}
