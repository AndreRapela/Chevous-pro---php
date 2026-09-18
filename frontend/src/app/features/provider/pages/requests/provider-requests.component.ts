import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { ProviderRequest } from '../../../../core/models';
import { LocalizationService } from '../../../../core/localization/localization.service';
import { displayReferenceAmount, referenceAmountToCents } from '../../../../core/localization/reference-currency.util';
import { PageHeaderComponent, StatePanelComponent } from '../../../../shared/components';
import { LocalizedDatePipe, LocalizedMoneyPipe } from '../../../../shared/localization/localized-format.pipe';

@Component({
  selector: 'cvp-provider-requests',
  standalone: true,
  imports: [LocalizedDatePipe, LocalizedMoneyPipe, PageHeaderComponent, StatePanelComponent],
  template: `
    <section class="portal-page provider-operations-page provider-requests-page">
      <cvp-page-header eyebrow="Novas oportunidades" title="Solicitações" description="Envie uma proposta com valor e mensagem claros."><span class="chip chip-soft">{{ requests().length }} abertas</span></cvp-page-header>
      @if (success()) { <div class="alert alert-success" role="status">{{ success() }}</div> }
      @if (actionError()) { <div class="alert alert-error" role="alert">{{ actionError() }}</div> }
      @if (loading()) { <cvp-state-panel kind="loading" /> }
      @else if (loadError()) { <cvp-state-panel kind="error" title="Solicitações indisponíveis" [message]="loadError()" (retry)="load()" /> }
      @else if (!requests().length) { <cvp-state-panel kind="empty" title="Tudo respondido" message="Avisaremos quando surgir uma nova oportunidade." /> }
      @else { <div class="request-list">@for (request of requests(); track request.id) {
        <article class="portal-card request-card"><div class="request-card-head"><span class="service-symbol">{{ initials(request.serviceName) }}</span><div><h2>{{ request.serviceName }}</h2><p data-cvp-no-localize>{{ request.city }}, {{ request.state }}</p></div><div class="request-price"><strong>{{ request.suggestedSubtotalCents / 100 | appMoney:request.currency }}</strong><small>referência da plataforma</small></div></div><dl><div><dt>Quando</dt><dd>{{ request.scheduledStart | appDate:'MMM d, yyyy, HH:mm' }}</dd></div><div><dt>Duração</dt><dd>{{ request.durationMinutes }} min</dd></div><div><dt>Área</dt><dd>{{ request.areaSqm || 'Não informada' }}{{ request.areaSqm ? ' m²' : '' }}</dd></div></dl><div class="form-grid"><label>Valor da proposta ({{ localization.currency() }})<input #amount type="number" [min]="minimumAmount(request)" [max]="maximumAmount(request)" step="0.01" [value]="displayAmount(request)"></label><label class="span-two">Mensagem<textarea #message maxlength="1000" placeholder="Explique o que está incluído"></textarea></label></div><div class="card-actions"><button class="btn btn-primary" type="button" [disabled]="acting()" (click)="offer(request, amount.value, message.value)">Enviar proposta</button></div></article>
      }</div> }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProviderRequestsComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  readonly localization = inject(LocalizationService);
  readonly requests = signal<ProviderRequest[]>([]);
  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly loadError = signal('');
  readonly actionError = signal('');
  readonly success = signal('');

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.marketplace.providerOpenRequests().subscribe({
      next: (requests) => { this.requests.set(requests); this.loading.set(false); },
      error: (failure: Error) => { this.loadError.set(failure.message); this.loading.set(false); }
    });
  }

  offer(request: ProviderRequest, amount: string, message: string): void {
    if (this.acting()) return;
    // An untouched rounded display value must not change the API reference by a few cents.
    const cents = amount.trim() && Number(amount) === this.displayAmount(request)
      ? request.suggestedSubtotalCents
      : referenceAmountToCents(amount, this.localization.currency(), request.currency);
    // Same source-currency limits enforced by ProviderController::createOffer.
    if (!Number.isFinite(cents) || cents < 1000 || cents > 10000000) {
      this.actionError.set('Informe um valor de proposta válido.');
      return;
    }
    this.acting.set(true);
    this.actionError.set('');
    this.marketplace.createOffer(request.id, cents, message.trim()).subscribe({
      next: () => {
        this.requests.update((items) => items.filter((item) => item.id !== request.id));
        this.success.set('Proposta enviada.');
        this.acting.set(false);
      },
      error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); }
    });
  }

  initials(value: string): string {
    return value.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
  }

  displayAmount(request: ProviderRequest): number {
    return displayReferenceAmount(request.suggestedSubtotalCents, request.currency, this.localization.currency());
  }

  minimumAmount(request: ProviderRequest): number {
    const cents = this.localization.convertAmount(10, request.currency) * 100;
    return Math.ceil(cents - Math.abs(cents) * Number.EPSILON * 4) / 100;
  }

  maximumAmount(request: ProviderRequest): number {
    const cents = this.localization.convertAmount(100000, request.currency) * 100;
    return Math.floor(cents + Math.abs(cents) * Number.EPSILON * 4) / 100;
  }
}
