import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Promotion, ProviderProfile, Service, ServiceCategory } from '../../../../core/models';
import {
  ProviderCardComponent,
  ServiceCardComponent,
  ServiceIconComponent,
  StatePanelComponent
} from '../../../../shared/components';
import { HorizontalScrollDirective } from '../../../../shared/directives/horizontal-scroll.directive';
import { categoryPublicPath } from '../../../../shared/utils/public-url.util';
import { SeoService } from '../../../../core/seo/seo.service';
import { HomeHeroComponent } from '../../components/home-hero/home-hero.component';

@Component({
  selector: 'cvp-home',
  standalone: true,
  imports: [
    HomeHeroComponent,
    HorizontalScrollDirective,
    ProviderCardComponent,
    RouterLink,
    ServiceCardComponent,
    ServiceIconComponent,
    StatePanelComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);
  heroQuery = '';
  readonly categories = signal<ServiceCategory[]>([]);
  readonly popularServices = signal<Service[]>([]);
  readonly providers = signal<ProviderProfile[]>([]);
  readonly promotion = signal<Promotion>({
    id: 'default',
    title: 'Produtos para cuidar melhor da sua casa',
    subtitle: 'Seleção de utilidades e equipamentos para facilitar sua rotina.',
    ctaLabel: 'Conhecer a loja',
    ctaUrl: '/produtos',
    imageUrl: '/images/promo-laundry-discount-v1.webp',
    badgeText: 'Novidades na loja',
    termsText: 'Preços e disponibilidade podem mudar sem aviso prévio.',
    backgroundColor: '#096653',
    textColor: '#FFFFFF'
  });
  readonly loading = signal(true);
  readonly error = signal('');
  readonly categoryPath = categoryPublicPath;

  searchServices(): void {
    const query = this.heroQuery.trim();
    void this.router.navigate(['/servicos'], { queryParams: query ? { q: query } : {} });
  }

  ngOnInit(): void {
    this.seo.update({
      title: 'Pro | Home services',
      description:
        'Find trusted professionals for your home, on the day and at the time you choose.',
      canonicalPath: '/',
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'ChezVoust Pro',
          url: '/',
          potentialAction: {
            '@type': 'SearchAction',
            target: '/servicos?q={search_term_string}',
            'query-input': 'required name=search_term_string'
          }
        },
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'ChezVoust Pro',
          url: '/'
        }
      ]
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.marketplace.categories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.loading.set(false);
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.loading.set(false);
      }
    });
    this.marketplace.home().subscribe({
      next: (content) => {
        if (content.promotions[0]) this.promotion.set(content.promotions[0]);
      },
      error: () => undefined
    });
    this.marketplace.servicesPage({ perPage: 4 }).subscribe({
      next: (services) => {
        const popular = services.data.filter((item) => item.popular);
        this.popularServices.set((popular.length ? popular : services.data).slice(0, 4));
      },
      error: () => this.popularServices.set([])
    });
    this.marketplace.providersPage({ perPage: 3 }).subscribe({
      next: (providers) => this.providers.set(providers.data),
      error: () => this.providers.set([])
    });
  }
}
