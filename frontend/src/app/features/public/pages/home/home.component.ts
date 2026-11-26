import { ChangeDetectionStrategy, Component, NgZone, OnInit, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Promotion, ProviderProfile, Service, ServiceCategory } from '../../../../core/models';
import { ProviderCardComponent, ServiceCardComponent, ServiceIconComponent, StatePanelComponent } from '../../../../shared/components';
import { PromotionMediaComponent } from '../../../../shared/components/promotion-media/promotion-media.component';
import { HorizontalScrollDirective } from '../../../../shared/directives/horizontal-scroll.directive';
import { categoryPublicPath } from '../../../../shared/utils/public-url.util';
import { DEFAULT_MEDIA_FRAME, promotionLinksAt } from '../../../../shared/utils/promotion-media.util';
import { nextPromotionIndex, PROMOTION_SLOT_MS } from '../../../../shared/utils/promotion-rotation.util';
import { SeoService } from '../../../../core/seo/seo.service';
import { HomeHeroComponent } from '../../components/home-hero/home-hero.component';
import { LocalizedCatalogTextPipe } from '../../../../shared/localization/localized-format.pipe';

const DEFAULT_PROMOTION: Promotion = {
  id: 'default', title: 'Produtos para cuidar melhor da sua casa', subtitle: 'Seleção de utilidades e equipamentos para facilitar sua rotina.',
  ctaLabel: 'Conhecer a loja', ctaUrl: '/produtos', imageUrl: '/images/promo-laundry-discount-v1.webp', badgeText: 'Novidades na loja',
  mediaType: 'image', buttonPlacement: 'banner', secondaryLinks: [],
  termsText: 'Preços e disponibilidade podem mudar sem aviso prévio.', backgroundColor: '#096653', textColor: '#FFFFFF'
};

@Component({
  selector: 'cvp-home',
  standalone: true,
  imports: [HomeHeroComponent, HorizontalScrollDirective, LocalizedCatalogTextPipe, PromotionMediaComponent, ProviderCardComponent, RouterLink, ServiceCardComponent, ServiceIconComponent, StatePanelComponent],
  template: `
    <cvp-home-hero [(query)]="heroQuery" (searchRequested)="searchServices()" />
    @if (promotion(); as campaign) {
      <section class="section home-section home-deals" aria-labelledby="discounts-title">
        <div class="container">
          <div class="home-deals-heading">
            <span class="eyebrow">Loja ChezVoust</span>
            <h2 id="discounts-title">Produtos e ofertas especiais</h2>
          </div>
          <article class="home-discount-banner" [class.has-media-background]="!!campaign.imageUrl && campaign.mediaFrame?.layout === 'background'" [style.--promo-bg]="campaign.backgroundColor" [style.--promo-text]="campaign.textColor">
            <div class="home-discount-copy">
              @if (campaign.badgeText) { <span class="home-discount-pill" data-cvp-no-localize>{{ campaign.badgeText | appCatalogText }}</span> }
              <h3 data-cvp-no-localize>{{ campaign.title | appCatalogText }}</h3>
              @if (campaign.subtitle) { <p data-cvp-no-localize>{{ campaign.subtitle | appCatalogText }}</p> }
              @if (campaign.buttonPlacement !== 'below') { <a class="btn home-discount-cta" [href]="campaign.ctaUrl" data-cvp-no-localize>{{ campaign.ctaLabel | appCatalogText }} <span aria-hidden="true">→</span></a> }
              @if (insideLinks().length) {
                <nav class="campaign-links-inside" aria-label="Mais links da campanha">
                  @for (link of insideLinks(); track $index) { <a [href]="link.url" data-cvp-no-localize>{{ link.label | appCatalogText }}</a> }
                </nav>
              }
            </div>
            <div class="home-discount-art" [class.home-discount-art-framed]="!!campaign.mediaFrame || campaign.mediaType === 'video'">
              @if (campaign.imageUrl) {
                @if (campaign.mediaFrame || (campaign.mediaType === 'video' ? defaultMediaFrame : null); as frame) {
                  <cvp-promotion-media [src]="campaign.imageUrl" [frame]="frame" [mediaType]="campaign.mediaType ?? 'image'"
                    [label]="campaign.mediaType === 'video' ? 'Vídeo da campanha' : ''" />
                }
                @else { <img [src]="campaign.imageUrl" alt="" width="720" height="377" loading="lazy" decoding="async"> }
              }
            </div>
          </article>
          @if (campaign.buttonPlacement === 'below' || campaign.buttonPlacement === 'both') { <div class="home-promotion-actions"><a class="btn btn-primary" [href]="campaign.ctaUrl" data-cvp-no-localize>{{ campaign.ctaLabel | appCatalogText }} <span aria-hidden="true">→</span></a></div> }
          @if (outsideLinks().length) { <nav class="home-promotion-links" aria-label="Links abaixo da campanha">@for (link of outsideLinks(); track $index) { <a [href]="link.url" data-cvp-no-localize>{{ link.label | appCatalogText }}</a> }</nav> }
          @if (campaign.termsText) { <p class="home-discount-terms" data-cvp-no-localize>{{ campaign.termsText | appCatalogText }}</p> }
        </div>
      </section>
    }

    <section class="section home-section home-categories" aria-labelledby="categorias-title">
      <div class="container">
        <div class="section-heading"><div><span class="eyebrow">Tudo em um só lugar</span><h2 id="categorias-title">Nossos serviços</h2></div><a class="text-link" routerLink="/servicos">Ver todos <span aria-hidden="true">→</span></a></div>
        @if (loading()) { <cvp-state-panel kind="loading" message="Buscando os melhores serviços para você." /> }
        @else if (error()) { <cvp-state-panel kind="error" title="Não conseguimos carregar os serviços" [message]="error()" (retry)="load()" /> }
        @else {
          <div class="category-grid" cvpHorizontalScroll aria-label="Nossos serviços. Deslize horizontalmente para ver mais categorias.">
            @for (category of categories(); track category.id) {
              <a class="category-card" [routerLink]="categoryPath(category)">
                <span class="category-symbol" aria-hidden="true"><cvp-service-icon [category]="category.id" [serviceSlug]="category.slug" [icon]="category.symbol" /></span><strong>{{ category.shortName }}</strong>
              </a>
            }
          </div>
          <p class="mobile-scroll-hint" aria-hidden="true">Deslize para ver mais <span>→</span></p>
        }
      </div>
    </section>

    @if (popularServices().length) {
      <section class="section section-mint home-section home-popular" aria-labelledby="popular-title">
        <div class="container">
          <div class="section-heading"><div><span class="eyebrow">Escolhas populares</span><h2 id="popular-title">Serviços mais procurados</h2></div></div>
          <div class="service-grid" cvpHorizontalScroll aria-label="Serviços mais procurados. Deslize horizontalmente para ver mais serviços.">
            @for (service of popularServices(); track service.id) { <cvp-service-card [service]="service" /> }
          </div>
          <p class="mobile-scroll-hint" aria-hidden="true">Deslize para ver mais <span>→</span></p>
        </div>
      </section>
    }

    @if (providers().length) {
      <section class="section home-section home-providers" aria-labelledby="recommendations-title">
        <div class="container">
          <div class="section-heading"><div><span class="eyebrow">Selecionados para você</span><h2 id="recommendations-title">Profissionais bem avaliados</h2></div><a class="text-link" routerLink="/profissionais">Ver todos <span aria-hidden="true">→</span></a></div>
          <div class="provider-grid" cvpHorizontalScroll aria-label="Profissionais bem avaliados. Deslize horizontalmente para ver mais profissionais.">
            @for (provider of providers().slice(0, 3); track provider.id) { <cvp-provider-card [provider]="provider" /> }
          </div>
          <p class="mobile-scroll-hint" aria-hidden="true">Deslize para ver mais <span>→</span></p>
        </div>
      </section>
    }

    <section class="section home-section home-provider-cta" aria-labelledby="provider-cta-title">
      <div class="container provider-cta">
        <div class="provider-cta-copy"><span class="eyebrow">Para profissionais</span><h2 id="provider-cta-title">Ofereça seus serviços com autonomia.</h2><p>Organize sua agenda e receba oportunidades pela plataforma.</p></div>
        <div class="provider-cta-actions">
          <span><b aria-hidden="true">✓</b>Defina sua disponibilidade</span>
          <span><b aria-hidden="true">✓</b>Escolha as oportunidades</span>
          <a class="btn btn-primary" routerLink="/cadastro" [queryParams]="{ tipo: 'profissional' }">Quero ser profissional</a>
        </div>
      </div>
    </section>
  `,
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly rotationReady = signal(false);
  heroQuery = '';
  readonly categories = signal<ServiceCategory[]>([]);
  readonly popularServices = signal<Service[]>([]);
  readonly providers = signal<ProviderProfile[]>([]);
  readonly promotions = signal<Promotion[]>([DEFAULT_PROMOTION]);
  readonly promotionIndex = signal(0);
  readonly promotion = computed(() => this.promotions()[this.promotionIndex()]);
  readonly defaultMediaFrame = DEFAULT_MEDIA_FRAME;
  readonly insideLinks = computed(() => promotionLinksAt(this.promotion()?.secondaryLinks, 'banner'));
  readonly outsideLinks = computed(() => promotionLinksAt(this.promotion()?.secondaryLinks, 'below'));
  readonly loading = signal(true);
  readonly error = signal('');
  readonly categoryPath = categoryPublicPath;

  constructor() {
    afterNextRender(() => this.rotationReady.set(true));
    effect((onCleanup) => {
      if (!this.rotationReady()) return;
      const campaigns = this.promotions();
      if (campaigns.length < 2) return;
      this.promotionIndex.set(nextPromotionIndex(campaigns));
      const interval = this.zone.runOutsideAngular(() => window.setInterval(() => {
        this.promotionIndex.update((current) => nextPromotionIndex(campaigns, current));
      }, PROMOTION_SLOT_MS));
      onCleanup(() => window.clearInterval(interval));
    });
  }

  searchServices(): void {
    const query = this.heroQuery.trim();
    void this.router.navigate(['/servicos'], { queryParams: query ? { q: query } : {} });
  }

  ngOnInit(): void {
    this.seo.update({
      title: 'Pro | Home services',
      description: 'Find trusted professionals for your home, on the day and at the time you choose.',
      canonicalPath: '/',
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'ChezVoust Pro',
          url: '/',
          potentialAction: { '@type': 'SearchAction', target: '/servicos?q={search_term_string}', 'query-input': 'required name=search_term_string' }
        },
        { '@context': 'https://schema.org', '@type': 'Organization', name: 'ChezVoust Pro', url: '/' }
      ]
    });
    this.load();
  }

  load(): void {
    this.loading.set(true); this.error.set('');
    this.marketplace.home().subscribe({
      next: ({ promotions, categories, services, professionals }) => {
        this.promotionIndex.set(0);
        this.promotions.set(promotions);
        this.categories.set(categories);
        const popular = services.filter((item) => item.popular);
        this.popularServices.set((popular.length ? popular : services).slice(0, 4));
        this.providers.set(professionals.slice(0, 3));
        this.loading.set(false);
      },
      error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); }
    });
  }
}
