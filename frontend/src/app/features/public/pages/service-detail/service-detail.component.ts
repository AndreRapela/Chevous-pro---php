import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { ProviderProfile, Service } from '../../../../core/models';
import { ProviderCardComponent, StatePanelComponent } from '../../../../shared/components';

@Component({
  selector: 'cvp-service-detail',
  standalone: true,
  imports: [CurrencyPipe, ProviderCardComponent, RouterLink, StatePanelComponent],
  template: `
    @if (loading()) { <div class="container section"><cvp-state-panel kind="loading" /></div> }
    @else if (error()) { <div class="container section"><cvp-state-panel kind="error" title="Serviço indisponível" [message]="error()" (retry)="load()" /></div> }
    @else if (service(); as item) {
      <section class="service-detail-hero"><div class="container service-detail-grid"><div><span class="kicker">Agendamento simples e seguro</span><h1>{{ item.name }}</h1><p>{{ item.description }}</p><div class="hero-actions"><a class="btn btn-primary" [routerLink]="['/agendar', item.id]">Agendar agora</a><span>A partir de <strong>{{ item.priceFromCents / 100 | currency:'BRL':'symbol':'1.0-0':'pt-BR' }}</strong></span></div></div><div class="service-visual" aria-hidden="true"><span>{{ item.symbol }}</span><i></i><i></i></div></div></section>
      <section class="section"><div class="container benefits-grid"><article><span>✓</span><h2>Perfis aprovados</h2><p>Informações e avaliações para ajudar você a escolher, sem alegação de certificação de identidade.</p></article><article><span>◇</span><h2>Preço transparente</h2><p>Veja a composição do valor antes de confirmar.</p></article><article><span>○</span><h2>Suporte durante o serviço</h2><p>Converse e acompanhe tudo pelo seu painel.</p></article></div></section>
      <section class="section section-mint"><div class="container"><div class="section-heading"><div><span class="eyebrow">Disponíveis para você</span><h2>Profissionais para {{ item.name.toLocaleLowerCase('pt-BR') }}</h2></div></div><div class="provider-grid">@for (provider of providers(); track provider.id) { <cvp-provider-card [provider]="provider" /> }</div></div></section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServiceDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly marketplace = inject(MarketplaceService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new BehaviorSubject(0);
  readonly service = signal<Service | null>(null);
  readonly providers = signal<ProviderProfile[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  ngOnInit(): void {
    combineLatest([
      this.route.paramMap.pipe(map((params) => params.get('slug') ?? '')),
      this.reload
    ]).pipe(
      switchMap(([id]) => {
        this.loading.set(true);
        this.error.set('');
        return this.marketplace.service(id).pipe(
          switchMap((service) => this.marketplace.providers({ serviceId: service.id }).pipe(map((providers) => ({ service, providers, error: '' })))),
          catchError((failure: Error) => of({ service: null, providers: [] as ProviderProfile[], error: failure.message }))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((result) => {
      this.service.set(result.service);
      this.providers.set(result.providers);
      this.error.set(result.error);
      this.loading.set(false);
    });
  }

  load(): void {
    this.reload.next(this.reload.value + 1);
  }
}
