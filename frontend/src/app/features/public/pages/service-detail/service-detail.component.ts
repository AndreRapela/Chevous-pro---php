import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, OnInit, afterNextRender, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { PromotionMediaFrame, ProviderProfile, Service } from '../../../../core/models';
import { ProviderCardComponent, StatePanelComponent } from '../../../../shared/components';
import { SeoService } from '../../../../core/seo/seo.service';
import { LocalizationService } from '../../../../core/localization/localization.service';
import { LocalizedCatalogTextPipe } from '../../../../shared/localization/localized-format.pipe';
import { PromotionMediaComponent } from '../../../../shared/components/promotion-media/promotion-media.component';
import { DEFAULT_MEDIA_FRAME } from '../../../../shared/utils/promotion-media.util';
import { nextPromotionIndex, PROMOTION_SLOT_MS } from '../../../../shared/utils/promotion-rotation.util';
import { providerPublicPath } from '../../../../shared/utils/public-url.util';
import { serviceInitial } from '../../../../shared/utils/service-name.util';

@Component({
  selector: 'cvp-service-detail',
  standalone: true,
  imports: [LocalizedCatalogTextPipe, PromotionMediaComponent, ProviderCardComponent, RouterLink, StatePanelComponent],
  template: `
    @if (loading()) { <div class="container section"><cvp-state-panel kind="loading" /></div> }
    @else if (error()) { <div class="container section"><cvp-state-panel kind="error" title="Serviço indisponível" [message]="error()" (retry)="load()" /></div> }
    @else if (service(); as item) {
      @let campaign = bannerCampaign();
      <section class="service-detail-hero">
        <article #banner class="container service-detail-grid" [style.--banner-bg]="campaign?.backgroundColor ?? null" [style.--banner-text]="campaign?.textColor ?? null">
          @if (campaign?.imageUrl; as artwork) {
            <div class="service-banner-media" aria-hidden="true">
              <cvp-promotion-media [src]="artwork" [frame]="backgroundFrame()" [mediaType]="campaign?.mediaType ?? 'image'" />
            </div>
          }
          <div class="service-detail-copy">
            @if (campaign) {
              <div class="service-banner-context">
                <h1 data-cvp-no-localize>{{ item.name | appCatalogText }}</h1>
                @if (campaign.badgeText) { <span class="service-banner-badge" data-cvp-no-localize>{{ campaign.badgeText | appCatalogText }}</span> }
              </div>
              <h2 class="service-banner-title" data-cvp-no-localize>{{ campaign.title | appCatalogText }}</h2>
            } @else {
              <span class="service-banner-badge">Agendamento simples e seguro</span>
              <h1 class="service-banner-title" data-cvp-no-localize>{{ item.name | appCatalogText }}</h1>
            }
            @if (campaign?.subtitle || item.description; as description) {
              <p class="service-banner-description" data-cvp-no-localize>{{ description | appCatalogText }}</p>
            }
            <div class="service-banner-actions">
              @if (campaign && campaign.ctaUrl && campaign.ctaLabel) {
                <a class="btn btn-primary service-banner-button" [href]="campaign.ctaUrl" data-cvp-no-localize>{{ campaign.ctaLabel | appCatalogText }} <span aria-hidden="true">→</span></a>
              } @else {
                <a class="btn btn-primary service-banner-button" [routerLink]="['/agendar', item.id]">Ver profissionais <span aria-hidden="true">→</span></a>
              }
              @if (campaign?.secondaryLinks?.length) {
                <nav class="service-banner-links" aria-label="Mais links da campanha">
                  @for (link of campaign?.secondaryLinks ?? []; track $index) { <a [href]="link.url" data-cvp-no-localize>{{ link.label | appCatalogText }}</a> }
                </nav>
              }
            </div>
            @if (campaign?.termsText; as terms) {
              <small class="service-banner-note" data-cvp-no-localize>{{ terms | appCatalogText }}</small>
            } @else {
              <small class="service-banner-note">Valor definido por cada profissional</small>
            }
          </div>
          <div class="service-detail-art">
            @if (featuredProvider(); as featured) {
              @for (person of [featured]; track person.id) {
                <a class="service-banner-profile" [routerLink]="profilePath(person)">
                  <span class="service-banner-portrait" aria-hidden="true">
                    @if (person.avatarUrl && person.avatarUrl !== failedPortrait()) {
                      <img [src]="person.avatarUrl" alt="" width="240" height="240" decoding="async" (error)="failedPortrait.set(person.avatarUrl ?? null)">
                    } @else { <span data-cvp-no-localize>{{ person.initials }}</span> }
                  </span>
                  <span class="service-banner-name" data-cvp-no-localize>{{ person.name }}</span>
                  <span class="service-banner-profile-action">Ver perfil <span aria-hidden="true">→</span></span>
                </a>
              }
            } @else {
              <span class="service-banner-portrait service-banner-illustration" aria-hidden="true">
                @if (item.isCustom) { <span data-cvp-no-localize>{{ serviceInitial(item.name) }}</span> }
                @else { <img [src]="heroImage(item)" alt="" width="240" height="240" decoding="async"> }
              </span>
            }
          </div>
        </article>
      </section>
      <section class="section section-mint service-detail-providers"><div class="container"><div class="section-heading"><div><span class="eyebrow">Disponíveis para você</span><h2>{{ localization.translate('Profissionais para') }} {{ localization.translate(item.name).toLocaleLowerCase(localization.locale()) }}</h2></div></div><div class="provider-grid service-detail-provider-grid">@for (provider of providers(); track provider.id) { <cvp-provider-card [provider]="provider" /> }</div></div></section>
    }
  `,
  styleUrl: './service-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServiceDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly marketplace = inject(MarketplaceService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly seo = inject(SeoService);
  private readonly zone = inject(NgZone);
  private readonly banner = viewChild<ElementRef<HTMLElement>>('banner');
  private readonly rotationReady = signal(false);
  private readonly campaignIndex = signal(0);
  private readonly professionalIndex = signal(0);
  protected readonly localization = inject(LocalizationService);
  private readonly reload = new BehaviorSubject(0);
  readonly service = signal<Service | null>(null);
  readonly providers = signal<ProviderProfile[]>([]);
  readonly featuredProvider = computed(() => this.providers()[this.professionalIndex()]);
  readonly bannerCampaign = computed(() => this.service()?.promotions?.[this.campaignIndex()]);
  readonly backgroundFrame = computed<PromotionMediaFrame>(() => ({
    ...DEFAULT_MEDIA_FRAME, fit: 'cover', ...this.bannerCampaign()?.mediaFrame, layout: 'background'
  }));
  readonly failedPortrait = signal<string | null>(null);
  readonly profilePath = providerPublicPath;
  readonly loading = signal(true);
  readonly error = signal('');
  constructor() {
    afterNextRender(() => this.rotationReady.set(true));
    effect((onCleanup) => {
      if (!this.rotationReady()) return;
      const campaigns = this.service()?.promotions ?? [];
      const professionalCount = this.providers().length;
      if (campaigns.length < 2 && professionalCount < 2) return;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      const interval = this.zone.runOutsideAngular(() => window.setInterval(() => {
        if (document.hidden || reducedMotion.matches || this.banner()?.nativeElement.matches(':focus-within')) return;
        if (campaigns.length > 1) this.campaignIndex.update((current) => nextPromotionIndex(campaigns, current));
        if (professionalCount > 1) this.professionalIndex.update((current) => (current + 1) % professionalCount);
      }, PROMOTION_SLOT_MS));
      onCleanup(() => window.clearInterval(interval));
    });
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
      this.campaignIndex.set(0);
      this.professionalIndex.set(0);
      this.failedPortrait.set(null);
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

  heroImage(service: Service): string {
    const category = service.categorySlug || service.categoryId;
    if (['cleaning', 'laundry', 'limpeza', 'lavanderia'].includes(category)) {
      return '/images/profissional-limpeza-hero-887.webp';
    }
    if (category === 'care' || category === 'cuidados') {
      return '/images/garconete-cadastro-v1-1086.webp';
    }
    return '/images/eletricista-login-v1-1280.webp';
  }

  serviceInitial(name: string): string { return serviceInitial(name); }

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
