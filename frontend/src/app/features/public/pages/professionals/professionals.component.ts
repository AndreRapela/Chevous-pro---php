import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, catchError, debounceTime, of, startWith, switchMap, tap } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { ProviderProfile, Service } from '../../../../core/models';
import { ProviderCardComponent, StatePanelComponent } from '../../../../shared/components';
import { pageFromMeta, totalFromMeta } from '../../../../shared/utils/pagination.util';

@Component({
  selector: 'cvp-professionals',
  standalone: true,
  imports: [FormsModule, ProviderCardComponent, StatePanelComponent],
  templateUrl: './professionals.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfessionalsComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly filterChanges = new Subject<void>();
  readonly providers = signal<ProviderProfile[]>([]);
  readonly services = signal<Service[]>([]);
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
  serviceId = '';
  city = '';
  minRating = 0;
  sort = 'recommended';
  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.serviceId = params.get('servico') ?? '';
    this.city = params.get('cidade') ?? '';
    this.minRating = Number(params.get('nota')) || 0;
    this.sort = params.get('ordenar') ?? 'recommended';
    this.page.set(pageFromMeta({ page: params.get('pagina') }, 'page'));
    this.marketplace
      .services()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (services) => this.services.set(services) });
    this.filterChanges
      .pipe(
        startWith(undefined),
        debounceTime(250),
        tap(() => {
          this.loading.set(true);
          this.error.set('');
        }),
        switchMap(() =>
          this.marketplace
            .providersPage(this.query(this.page()))
            .pipe(
              catchError((failure: Error) =>
                of({ data: [] as ProviderProfile[], meta: {}, failure })
              )
            )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        const failure = 'failure' in response ? response.failure : undefined;
        if (failure) {
          this.error.set(failure.message);
          this.providers.set([]);
          this.total.set(0);
          this.loading.set(false);
          return;
        }
        this.providers.set(response.data);
        this.page.set(pageFromMeta(response.meta, 'page'));
        this.lastPage.set(pageFromMeta(response.meta, 'lastPage'));
        this.total.set(totalFromMeta(response.meta));
        this.loading.set(false);
      });
  }
  load(): void {
    this.filterChanges.next();
  }
  filtersChanged(): void {
    this.page.set(1);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        servico: this.serviceId || null,
        cidade: this.city.trim() || null,
        nota: this.minRating || null,
        ordenar: this.sort === 'recommended' ? null : this.sort,
        pagina: null
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.filterChanges.next();
  }
  clearFilters(): void {
    this.serviceId = '';
    this.city = '';
    this.minRating = 0;
    this.sort = 'recommended';
    this.filtersChanged();
  }
  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage() || page === this.page()) return;
    this.page.set(page);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { pagina: page > 1 ? page : null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.filterChanges.next();
  }
  firstVisible(): number {
    return this.total() ? (this.page() - 1) * this.pageSize + 1 : 0;
  }
  lastVisible(): number {
    return Math.min(this.page() * this.pageSize, this.total());
  }
  private query(page: number) {
    return {
      serviceId: this.serviceId || undefined,
      city: this.city.trim() || undefined,
      minRating: this.minRating || undefined,
      sort: this.sort,
      page,
      perPage: this.pageSize
    };
  }
}
