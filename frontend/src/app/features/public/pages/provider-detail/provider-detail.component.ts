import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, forkJoin, map, of, switchMap } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { ProfessionalComment, ProviderProfile, Review, Service } from '../../../../core/models';
import {
  AvatarComponent,
  RatingComponent,
  ServiceIconComponent,
  StatePanelComponent
} from '../../../../shared/components';
import {
  LocalizedDatePipe,
  LocalizedMoneyPipe,
  LocalizedNumberPipe
} from '../../../../shared/localization/localized-format.pipe';
import {
  mergeUniqueById,
  pageFromMeta,
  totalFromMeta
} from '../../../../shared/utils/pagination.util';
import { providerPublicPath } from '../../../../shared/utils/public-url.util';
import { SeoService } from '../../../../core/seo/seo.service';
import { LocalizationService } from '../../../../core/localization/localization.service';

@Component({
  selector: 'cvp-provider-detail',
  standalone: true,
  imports: [
    AvatarComponent,
    LocalizedDatePipe,
    LocalizedMoneyPipe,
    LocalizedNumberPipe,
    RatingComponent,
    RouterLink,
    ServiceIconComponent,
    StatePanelComponent
  ],
  templateUrl: './provider-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProviderDetailComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly seo = inject(SeoService);
  private readonly localization = inject(LocalizationService);
  private readonly reload = new BehaviorSubject(0);
  readonly provider = signal<ProviderProfile | null>(null);
  readonly offeredServices = signal<Service[]>([]);
  readonly reviews = signal<Review[]>([]);
  readonly comments = signal<ProfessionalComment[]>([]);
  readonly reviewPage = signal(1);
  readonly reviewLastPage = signal(1);
  readonly commentPage = signal(1);
  readonly commentLastPage = signal(1);
  readonly commentTotal = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly favorite = signal(false);
  readonly commentSending = signal(false);
  readonly commentError = signal('');
  readonly loadingMoreReviews = signal(false);
  readonly loadingMoreComments = signal(false);
  readonly reportTarget = signal<{ type: 'professional_comment' | 'review'; id: string } | null>(
    null
  );
  readonly reportSending = signal(false);
  readonly reportError = signal('');
  readonly conversationError = signal('');

  constructor() {
    effect(() => {
      this.localization.language();
      const person = this.provider();
      if (person) this.updateSeo(person, this.reviews());
    });
  }

  ngOnInit(): void {
    combineLatest([this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), this.reload])
      .pipe(
        switchMap(([id]) => {
          this.loading.set(true);
          this.error.set('');
          return this.marketplace.provider(id).pipe(
            switchMap((provider) =>
              forkJoin({
                services: this.marketplace.services({ professional: id }),
                reviews: this.marketplace.providerReviewsPage(id),
                comments: this.marketplace.providerCommentsPage(id),
                favorites:
                  this.auth.user()?.role === 'customer'
                    ? this.marketplace.favorites()
                    : of([] as ProviderProfile[])
              }).pipe(
                map(({ services, reviews, comments, favorites }) => ({
                  provider,
                  reviews,
                  comments,
                  services,
                  favorite: favorites.some((item) => item.id === provider.id),
                  error: ''
                }))
              )
            ),
            catchError((failure: Error) =>
              of({
                provider: null,
                reviews: null,
                comments: null,
                services: [] as Service[],
                favorite: false,
                error: failure.message
              })
            )
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((result) => {
        this.provider.set(result.provider);
        this.offeredServices.set(result.services);
        this.reviews.set(result.reviews?.data ?? []);
        this.comments.set(result.comments?.data ?? []);
        this.reviewPage.set(pageFromMeta(result.reviews?.meta, 'page'));
        this.reviewLastPage.set(pageFromMeta(result.reviews?.meta, 'lastPage'));
        this.commentPage.set(pageFromMeta(result.comments?.meta, 'page'));
        this.commentLastPage.set(pageFromMeta(result.comments?.meta, 'lastPage'));
        this.commentTotal.set(totalFromMeta(result.comments?.meta));
        this.favorite.set(result.favorite);
        this.error.set(result.error);
        this.loading.set(false);
        if (result.provider) this.updateSeo(result.provider, result.reviews?.data ?? []);
      });
  }

  load(): void {
    this.reload.next(this.reload.value + 1);
  }
  toggleFavorite(): void {
    const person = this.provider();
    if (!person) return;
    if (this.auth.user()?.role !== 'customer') {
      void this.router.navigate(['/entrar'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.favorite.update((value) => !value);
    this.marketplace
      .favorite(person.id, this.favorite())
      .subscribe({ error: () => this.favorite.update((value) => !value) });
  }
  startConversation(professionalId: string): void {
    if (this.auth.user()?.role !== 'customer') {
      void this.router.navigate(['/entrar'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.conversationError.set('');
    this.marketplace.startProfessionalConversation(professionalId).subscribe({
      next: ({ conversationId }) =>
        void this.router.navigate(['/conta/mensagens'], {
          queryParams: { conversa: conversationId }
        }),
      error: (failure: Error) =>
        this.conversationError.set(failure.message || 'Não foi possível iniciar a conversa agora.')
    });
  }
  postComment(input: HTMLTextAreaElement): void {
    const person = this.provider();
    const comment = input.value.trim();
    if (!person || this.commentSending()) return;
    if (comment.length < 3) {
      this.commentError.set('Escreva pelo menos 3 caracteres.');
      return;
    }
    this.commentSending.set(true);
    this.commentError.set('');
    this.marketplace.createProviderComment(person.id, comment).subscribe({
      next: (created) => {
        this.comments.update((items) => [created, ...items]);
        this.commentTotal.update((total) => total + 1);
        input.value = '';
        this.commentSending.set(false);
      },
      error: (failure: Error) => {
        this.commentError.set(failure.message);
        this.commentSending.set(false);
      }
    });
  }
  loadMoreReviews(): void {
    const person = this.provider();
    const nextPage = this.reviewPage() + 1;
    if (!person || this.loadingMoreReviews() || nextPage > this.reviewLastPage()) return;
    this.loadingMoreReviews.set(true);
    this.marketplace.providerReviewsPage(person.id, nextPage).subscribe({
      next: (response) => {
        this.reviews.update((items) => mergeUniqueById(items, response.data));
        this.reviewPage.set(pageFromMeta(response.meta, 'page'));
        this.reviewLastPage.set(pageFromMeta(response.meta, 'lastPage'));
        this.loadingMoreReviews.set(false);
      },
      error: () => this.loadingMoreReviews.set(false)
    });
  }
  loadMoreComments(): void {
    const person = this.provider();
    const nextPage = this.commentPage() + 1;
    if (!person || this.loadingMoreComments() || nextPage > this.commentLastPage()) return;
    this.loadingMoreComments.set(true);
    this.marketplace.providerCommentsPage(person.id, nextPage).subscribe({
      next: (response) => {
        this.comments.update((items) => mergeUniqueById(items, response.data));
        this.commentPage.set(pageFromMeta(response.meta, 'page'));
        this.commentLastPage.set(pageFromMeta(response.meta, 'lastPage'));
        this.commentTotal.set(totalFromMeta(response.meta));
        this.loadingMoreComments.set(false);
      },
      error: () => this.loadingMoreComments.set(false)
    });
  }
  startReport(type: 'professional_comment' | 'review', id: string): void {
    if (!this.auth.user()) {
      void this.router.navigate(['/entrar'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.reportError.set('');
    this.reportTarget.set({ type, id });
  }
  submitReport(event: Event, reason: string): void {
    event.preventDefault();
    const target = this.reportTarget();
    if (!target || reason.trim().length < 8 || this.reportSending()) return;
    this.reportSending.set(true);
    this.reportError.set('');
    this.marketplace.reportContent(target.type, target.id, reason.trim()).subscribe({
      next: () => {
        this.reportSending.set(false);
        this.reportTarget.set(null);
      },
      error: (failure: Error) => {
        this.reportError.set(failure.message);
        this.reportSending.set(false);
      }
    });
  }
  defaultServiceId(): string {
    return this.offeredServices()[0]?.id ?? 'clean-home';
  }

  private updateSeo(provider: ProviderProfile, reviews: Review[]): void {
    const canonicalPath = providerPublicPath(provider).join('/');
    const headline = provider.headline;
    const description =
      provider.bio ||
      `${provider.name} · ${provider.city}. ${this.localization.translate('Veja experiência, serviços e avaliações de reservas.')}`;
    const title = `${provider.name} | ${headline} | Pro`;
    const person: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: provider.name,
      description,
      jobTitle: headline,
      url: canonicalPath,
      address: {
        '@type': 'PostalAddress',
        addressLocality: provider.city,
        ...(provider.state ? { addressRegion: provider.state } : {})
      },
      knowsAbout: provider.qualities.map((quality) => this.localization.translate(quality))
    };
    if (provider.avatarUrl) person['image'] = provider.avatarUrl;
    if (provider.reviewCount > 0) {
      person['aggregateRating'] = {
        '@type': 'AggregateRating',
        ratingValue: provider.rating,
        reviewCount: provider.reviewCount,
        bestRating: 5,
        worstRating: 1
      };
      person['review'] = reviews.slice(0, 5).map((review) => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: review.author },
        reviewRating: {
          '@type': 'Rating',
          ratingValue: review.rating,
          bestRating: 5,
          worstRating: 1
        },
        reviewBody: review.comment,
        datePublished: review.createdAt
      }));
    }
    this.seo.update({
      title,
      description,
      canonicalPath,
      type: 'profile',
      translateContent: false,
      imagePath: provider.avatarUrl ?? undefined,
      structuredData: [
        person,
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: this.localization.translate('Início'),
              item: '/'
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: this.localization.translate('Profissionais'),
              item: '/profissionais'
            },
            { '@type': 'ListItem', position: 3, name: provider.name, item: canonicalPath }
          ]
        }
      ]
    });
  }
}
