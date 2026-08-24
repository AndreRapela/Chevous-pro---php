import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { ProviderJob } from '../../../../core/models';
import { PageHeaderComponent, StatePanelComponent } from '../../../../shared/components';

@Component({
  selector: 'cvp-provider-earnings',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, PageHeaderComponent, StatePanelComponent],
  template: `
    <section class="portal-page provider-operations-page provider-earnings-page">
      <cvp-page-header eyebrow="Controle financeiro" title="Ganhos" description="Valores calculados a partir dos serviços retornados pela API." />
      @if (loading()) { <cvp-state-panel kind="loading" /> }
      @else if (error()) { <cvp-state-panel kind="error" title="Ganhos indisponíveis" [message]="error()" (retry)="load()" /> }
      @else {
        <div class="metric-grid"><article class="metric-card metric-brand"><p>Ganhos concluídos</p><strong>{{ completedEarnings() / 100 | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong><small>{{ completedCount() }} serviços</small></article><article class="metric-card metric-amber"><p>Em andamento</p><strong>{{ pendingEarnings() / 100 | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong><small>valores ainda não concluídos</small></article></div>
        <section class="portal-card"><div class="card-title-row"><h2>Serviços e valores</h2></div><div class="transaction-list">@for (job of jobs(); track job.id) { <article><span class="transaction-symbol">+</span><div><strong>{{ job.serviceName }}</strong><small>{{ job.scheduledStart | date:'dd/MM/yyyy':'':'pt-BR' }} · {{ job.customerName }}</small></div><strong>{{ job.professionalAmountCents / 100 | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong></article> }</div></section>
        <aside class="portal-card"><span class="chip chip-soft">Demonstração</span><h2>Dados de repasse</h2><p class="muted">A API atual não expõe conta bancária ou calendário de repasses; nenhum dado bancário fictício é exibido.</p></aside>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProviderEarningsComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  readonly jobs = signal<ProviderJob[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly completedEarnings = computed(() => this.jobs().filter((job) => job.status === 'completed').reduce((sum, job) => sum + job.professionalAmountCents, 0));
  readonly pendingEarnings = computed(() => this.jobs().filter((job) => job.status !== 'completed' && job.status !== 'cancelled').reduce((sum, job) => sum + job.professionalAmountCents, 0));
  readonly completedCount = computed(() => this.jobs().filter((job) => job.status === 'completed').length);

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
