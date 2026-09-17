import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, combineLatest, debounceTime, distinctUntilChanged } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Service, ServiceCategory } from '../../../../core/models';
import { ServiceCardComponent, StatePanelComponent } from '../../../../shared/components';
import { SeoService } from '../../../../core/seo/seo.service';
import { categoryPublicPath } from '../../../../shared/utils/public-url.util';

@Component({
  selector: 'cvp-catalog',
  standalone: true,
  imports: [ServiceCardComponent, StatePanelComponent],
  template: `
    <section class="page-hero compact catalog-hero"><div class="container narrow"><span class="eyebrow">Catálogo completo</span><h1>Encontre o serviço certo</h1><p>Profissionais para cuidar da casa, da rotina e de quem você ama.</p>
      <label class="search-field"><span aria-hidden="true">⌕</span><span class="sr-only">Buscar serviço</span><input type="search" [value]="query()" (input)="setQuery($any($event.target).value)" placeholder="Busque por limpeza, montagem, pet..." autocomplete="off"></label>
    </div></section>
    <section class="section section-tight catalog-results"><div class="container">
      <div class="filter-scroll" aria-label="Filtrar por categoria">
        <button type="button" class="chip" [class.active]="!category()" (click)="selectCategory('')">Todos</button>
        @for (item of categories(); track item.id) { <button type="button" class="chip" [class.active]="category() === item.id" (click)="selectCategory(item.id)">{{ item.shortName }}</button> }
      </div>
      <div class="results-heading"><h2>{{ total() }} serviços disponíveis</h2><span>Preço inicial, sujeito aos detalhes da solicitação</span></div>
      @if (loading()) { <cvp-state-panel kind="loading" /> }
      @else if (error()) { <cvp-state-panel kind="error" title="O catálogo não carregou" [message]="error()" (retry)="load()" /> }
      @else if (!services().length) { <cvp-state-panel kind="empty" title="Nenhum serviço encontrado" message="Tente outro termo ou remova um dos filtros." /> }
      @else {
        <div class="service-grid catalog-grid">@for (service of services(); track service.id) { <cvp-service-card [service]="service" /> }</div>
        @if (lastPage() > 1) {
          <nav class="result-pagination" aria-label="Paginação de serviços">
            <span>Mostrando {{ firstVisible() }}–{{ lastVisible() }} de {{ total() }} serviços</span>
            <div>
              <button class="btn btn-secondary btn-small" type="button" [disabled]="page() === 1" (click)="goToPage(page() - 1)">Anterior</button>
              @for (item of pageNumbers(); track item) { <button class="page-button" type="button" [class.active]="item === page()" [attr.aria-current]="item === page() ? 'page' : null" (click)="goToPage(item)">{{ item }}</button> }
              <button class="btn btn-secondary btn-small" type="button" [disabled]="page() === lastPage()" (click)="goToPage(page() + 1)">Próxima</button>
            </div>
          </nav>
        }
      }
    </div></section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly seo = inject(SeoService);
  private readonly searchChanges = new Subject<string>();
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
  readonly pageSize = 9;
  readonly pageNumbers = computed(() => {
    const last = this.lastPage();
    const start = Math.max(1, Math.min(this.page() - 2, Math.max(1, last - 4)));
    return Array.from({ length: Math.min(5, last - start + 1) }, (_, index) => start + index);
  });

  ngOnInit(): void {
    this.searchChanges.pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe((value) => this.syncUrl(value, 1));
    this.marketplace.categories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (categories) => { this.categories.set(categories); this.resolveCategoryFromUrl(); this.updateSeo(); },
      error: (failure: Error) => this.error.set(failure.message)
    });
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(([path, query]) => {
      this.categorySlug.set(path.get('category') ?? '');
      this.query.set(query.get('q') ?? '');
      this.page.set(this.validPage(query.get('pagina')));
      this.resolveCategoryFromUrl();
      this.updateSeo();
      this.load();
    });
  }
  load(): void {
    this.loading.set(true); this.error.set('');
    this.marketplace.servicesPage({ category: this.categorySlug() || undefined, q: this.query().trim() || undefined, page: this.page(), perPage: this.pageSize }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.services.set(response.data);
        this.total.set(this.metaNumber(response.meta, 'total', response.data.length));
        this.page.set(this.metaNumber(response.meta, 'page', this.page()));
        this.lastPage.set(this.metaNumber(response.meta, 'lastPage', 1));
        this.loading.set(false);
      },
      error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); }
    });
  }
  setQuery(value: string): void { this.query.set(value); this.searchChanges.next(value.trim()); }
  selectCategory(id: string): void { this.category.set(id); this.syncUrl(this.query(), 1); }
  goToPage(page: number): void { if (page >= 1 && page <= this.lastPage() && page !== this.page()) this.syncUrl(this.query(), page); }
  firstVisible(): number { return this.total() ? (this.page() - 1) * this.pageSize + 1 : 0; }
  lastVisible(): number { return Math.min(this.page() * this.pageSize, this.total()); }
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

  private validPage(value: string | null): number { return Math.max(1, Number(value) || 1); }
  private metaNumber(meta: Record<string, unknown> | undefined, key: string, fallback: number): number {
    const value = Number(meta?.[key]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  private updateSeo(): void {
    const selected = this.categories().find((item) => item.slug === this.categorySlug());
    const canonicalPath = selected ? `/servicos/categoria/${selected.slug}` : '/servicos';
    const title = selected ? `${selected.name} para casa | ChezVoust Pro` : 'Serviços para casa | ChezVoust Pro';
    const description = selected
      ? `${selected.description} Compare opções e solicite um horário com profissionais aprovados.`
      : 'Encontre serviços para casa, compare opções e solicite um horário com profissionais aprovados.';
    this.seo.update({
      title,
      description,
      canonicalPath,
      noindex: Boolean(this.query().trim()),
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: title.replace(' | ChezVoust Pro', ''),
        description,
        url: canonicalPath
      }
    });
  }
}
