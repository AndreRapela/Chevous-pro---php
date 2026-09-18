import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { ProviderProfile, Service } from '../../../../core/models';
import { ProviderCardComponent, ServiceIconComponent, StatePanelComponent } from '../../../../shared/components';
import { LocalizedMoneyPipe } from '../../../../shared/localization/localized-format.pipe';
import { SeoService } from '../../../../core/seo/seo.service';
import { LocalizationService } from '../../../../core/localization/localization.service';

@Component({
  selector: 'cvp-service-detail',
  standalone: true,
  imports: [LocalizedMoneyPipe, ProviderCardComponent, RouterLink, ServiceIconComponent, StatePanelComponent],
  template: `
    @if (loading()) { <div class="container section"><cvp-state-panel kind="loading" /></div> }
    @else if (error()) { <div class="container section"><cvp-state-panel kind="error" title="Serviço indisponível" [message]="error()" (retry)="load()" /></div> }
    @else if (service(); as item) {
      <section class="service-detail-hero"><div class="container service-detail-grid"><div><span class="kicker">Agendamento simples e seguro</span><h1>{{ item.name }}</h1><p>{{ item.description }}</p><div class="hero-actions"><a class="btn btn-primary" [routerLink]="['/agendar', item.id]">Agendar agora</a><span>A partir de <strong>{{ item.priceFromCents / 100 | appMoney:'BRL':0 }}</strong></span></div></div><div class="service-visual" aria-hidden="true"><span><cvp-service-icon [category]="item.categoryId" [serviceSlug]="item.slug" /></span><i></i><i></i></div></div></section>
      <section class="section section-mint service-detail-providers"><div class="container"><div class="section-heading"><div><span class="eyebrow">Disponíveis para você</span><h2>{{ localization.translate('Profissionais para') }} {{ localization.translate(item.name).toLocaleLowerCase(localization.locale()) }}</h2></div></div><div class="provider-grid service-detail-provider-grid">@for (provider of providers(); track provider.id) { <cvp-provider-card [provider]="provider" /> }</div></div></section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServiceDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly marketplace = inject(MarketplaceService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly seo = inject(SeoService);
  protected readonly localization = inject(LocalizationService);
  private readonly reload = new BehaviorSubject(0);
  readonly service = signal<Service | null>(null);
  readonly providers = signal<ProviderProfile[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  constructor() {
    effect(() => {
      this.localization.language();
      const item = this.service();
      if (item) this.updateSeo(item);
    });
  }
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
      if (result.service) this.updateSeo(result.service);
    });
  }

  load(): void {
    this.reload.next(this.reload.value + 1);
  }

  private updateSeo(service: Service): void {
    const canonicalPath = `/servicos/${service.slug}`;
    const translatedName = this.localization.translate(service.name);
    const translatedDescription = this.localization.translate(service.description);
    const title = `${translatedName} | Pro`;
    const description = `${translatedDescription} ${this.localization.translate('Compare profissionais aprovados e solicite um horário.')}`;
    this.seo.update({
      title,
      description,
      canonicalPath,
      type: 'article',
      translateContent: false,
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: translatedName,
          description: translatedDescription,
          url: canonicalPath,
          provider: { '@type': 'Organization', name: 'ChezVoust Pro' }
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: this.localization.translate('Início'), item: '/' },
            { '@type': 'ListItem', position: 2, name: this.localization.translate('Serviços'), item: '/servicos' },
            { '@type': 'ListItem', position: 3, name: translatedName, item: canonicalPath }
          ]
        }
      ]
    });
  }
}
