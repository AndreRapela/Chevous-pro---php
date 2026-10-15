import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Subject,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
  of,
  tap
} from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Service, ServiceCategory } from '../../../../core/models';
import { ServiceCardComponent, StatePanelComponent } from '../../../../shared/components';
import { SeoService } from '../../../../core/seo/seo.service';
import { LocalizationService } from '../../../../core/localization/localization.service';
import { categoryPublicPath } from '../../../../shared/utils/public-url.util';
import { pageFromMeta, totalFromMeta } from '../../../../shared/utils/pagination.util';

@Component({
  selector: 'cvp-catalog',
  standalone: true,
  imports: [ServiceCardComponent, StatePanelComponent],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly seo = inject(SeoService);
  private readonly localization = inject(LocalizationService);
  private readonly searchChanges = new Subject<string>();
  private readonly loadRequests = new Subject<void>();
  readonly services = signal<Service[]>([]);
  readonly categories = signal<ServiceCategory[]>([]);
  readonly query = signal('');
  readonly category = signal('');
  private readonly categorySlug = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly total = signal(0);
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly pageSize = 20;
  readonly pageNumbers = computed(() => {
    const last = this.lastPage();
    const start = Math.max(1, Math.min(this.page() - 2, Math.max(1, last - 4)));
    return Array.from({ length: Math.min(5, last - start + 1) }, (_, index) => start + index);
  });
  constructor() {
    effect(() => {
      this.localization.language();
      this.updateSeo();
    });
  }

  ngOnInit(): void {
    this.loadRequests
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set('');
        }),
        switchMap(() =>
          this.marketplace
            .servicesPage({
              category: this.categorySlug() || undefined,
              q: this.query().trim() || undefined,
              page: this.page(),
              perPage: this.pageSize
            })
            .pipe(catchError((failure: Error) => of({ data: [] as Service[], meta: {}, failure })))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        const failure = 'failure' in response ? response.failure : undefined;
        if (failure) {
          this.error.set(failure.message);
          this.services.set([]);
          this.total.set(0);
        } else {
          this.services.set(response.data);
          this.total.set(totalFromMeta(response.meta));
          this.page.set(pageFromMeta(response.meta, 'page'));
          this.lastPage.set(pageFromMeta(response.meta, 'lastPage'));
        }
        this.loading.set(false);
      });
    this.searchChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.syncUrl(value, 1));
    this.marketplace
      .categories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => {
          this.categories.set(categories);
          this.resolveCategoryFromUrl();
          this.updateSeo();
        },
        error: (failure: Error) => this.error.set(failure.message)
      });
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([path, query]) => {
        this.categorySlug.set(path.get('category') ?? '');
        this.query.set(query.get('q') ?? '');
        this.page.set(this.validPage(query.get('pagina')));
        this.resolveCategoryFromUrl();
        this.updateSeo();
        this.load();
      });
  }
  load(): void {
    this.loadRequests.next();
  }
  setQuery(value: string): void {
    this.query.set(value);
    this.searchChanges.next(value.trim());
  }
  selectCategory(id: string): void {
    this.category.set(id);
    this.syncUrl(this.query(), 1);
  }
  goToPage(page: number): void {
    if (page >= 1 && page <= this.lastPage() && page !== this.page())
      this.syncUrl(this.query(), page);
  }
  firstVisible(): number {
    return this.total() ? (this.page() - 1) * this.pageSize + 1 : 0;
  }
  lastVisible(): number {
    return Math.min(this.page() * this.pageSize, this.total());
  }
  private resolveCategoryFromUrl(): void {
    const selected = this.categories().find((item) => item.slug === this.categorySlug());
    this.category.set(selected?.id ?? '');
  }

  private syncUrl(query = this.query(), page = 1): void {
    const selected = this.categories().find((item) => item.id === this.category());
    void this.router.navigate(selected ? categoryPublicPath(selected) : ['/servicos'], {
      queryParams: { q: query || null, pagina: page > 1 ? page : null },
      replaceUrl: true
    });
  }

  private validPage(value: string | null): number {
    return pageFromMeta({ page: value }, 'page');
  }

  private updateSeo(): void {
    const selected = this.categories().find((item) => item.slug === this.categorySlug());
    const canonicalPath = selected ? `/servicos/categoria/${selected.slug}` : '/servicos';
    const title = selected
      ? `${this.localization.translate(selected.name)} | Pro`
      : this.localization.translate('Home services | Pro');
    const description = selected
      ? `${this.localization.translate(selected.description)} ${this.localization.translate('Compare opções e solicite um horário com profissionais aprovados.')}`
      : this.localization.translate(
          'Encontre serviços para casa, compare opções e solicite um horário com profissionais aprovados.'
        );
    this.seo.update({
      title,
      description,
      canonicalPath,
      noindex: Boolean(this.query().trim()),
      translateContent: false,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: title.replace(' | Pro', ''),
        description,
        url: canonicalPath
      }
    });
  }
}
