import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { ProviderProfile, Service, ServiceCategory } from '../../../../core/models';
import { ProviderCardComponent, ServiceCardComponent, ServiceIconComponent, StatePanelComponent } from '../../../../shared/components';
import { HorizontalScrollDirective } from '../../../../shared/directives/horizontal-scroll.directive';
import { HomeHeroComponent } from '../../components/home-hero/home-hero.component';
import { categoryPublicPath } from '../../../../shared/utils/public-url.util';
import { SeoService } from '../../../../core/seo/seo.service';

@Component({
  selector: 'cvp-home',
  standalone: true,
  imports: [HomeHeroComponent, HorizontalScrollDirective, ProviderCardComponent, RouterLink, ServiceCardComponent, ServiceIconComponent, StatePanelComponent],
  template: `
    <cvp-home-hero [(query)]="query" (searchRequested)="search()" />

    <section class="section home-section home-categories" aria-labelledby="categorias-title">
      <div class="container">
        <div class="section-heading"><div><span class="eyebrow">Tudo em um só lugar</span><h2 id="categorias-title">Do que sua casa precisa?</h2></div><a class="text-link" routerLink="/servicos">Ver todos <span aria-hidden="true">→</span></a></div>
        @if (loading()) { <cvp-state-panel kind="loading" message="Buscando os melhores serviços para você." /> }
        @else if (error()) { <cvp-state-panel kind="error" title="Não conseguimos carregar os serviços" [message]="error()" (retry)="load()" /> }
        @else {
          <div class="category-grid" cvpHorizontalScroll aria-label="Do que sua casa precisa? Deslize horizontalmente para ver mais categorias.">
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

    <section class="section home-section home-deals" aria-labelledby="discounts-title">
      <div class="container">
        <div class="home-deals-heading">
          <span class="eyebrow">Ofertas para você</span>
          <h2 id="discounts-title">Descontos e ofertas especiais</h2>
        </div>
        <article class="home-discount-banner">
          <div class="home-discount-copy">
            <span class="home-discount-pill">Oferta por tempo limitado</span>
            <h3>Até 25% de desconto</h3>
            <p>Em serviços selecionados para cuidar da sua casa.</p>
            <a class="btn home-discount-cta" routerLink="/servicos">Ver ofertas <span aria-hidden="true">→</span></a>
          </div>
          <div class="home-discount-art" aria-hidden="true">
            <span class="home-discount-bubble"><strong>25%</strong><small>OFF</small></span>
            <img src="/images/promo-laundry-discount-v1.webp" alt="" width="720" height="377" loading="lazy" decoding="async">
          </div>
        </article>
        <p class="home-discount-terms">Consulte as condições e a disponibilidade de cada oferta.</p>
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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  readonly categories = signal<ServiceCategory[]>([]);
  readonly popularServices = signal<Service[]>([]);
  readonly providers = signal<ProviderProfile[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  query = '';
  readonly categoryPath = categoryPublicPath;

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
    forkJoin({ categories: this.marketplace.categories(), services: this.marketplace.servicesPage({ perPage: 4 }), providers: this.marketplace.providersPage({ perPage: 3 }) }).subscribe({
      next: ({ categories, services, providers }) => {
        const popular = services.data.filter((item) => item.popular);
        this.categories.set(categories); this.popularServices.set((popular.length ? popular : services.data).slice(0, 4)); this.providers.set(providers.data); this.loading.set(false);
      },
      error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); }
    });
  }

  search(): void {
    void this.router.navigate(['/servicos'], { queryParams: this.query.trim() ? { q: this.query.trim() } : {} });
  }
}
