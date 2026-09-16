import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, combineLatest, debounceTime, distinctUntilChanged, forkJoin } from 'rxjs';
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
      <div class="results-heading"><h2>{{ filtered().length }} serviços disponíveis</h2><span>Preço inicial, sujeito aos detalhes da solicitação</span></div>
      @if (loading()) { <cvp-state-panel kind="loading" /> }
      @else if (error()) { <cvp-state-panel kind="error" title="O catálogo não carregou" [message]="error()" (retry)="load()" /> }
      @else if (!filtered().length) { <cvp-state-panel kind="empty" title="Nenhum serviço encontrado" message="Tente outro termo ou remova um dos filtros." /> }
      @else { <div class="service-grid catalog-grid">@for (service of filtered(); track service.id) { <cvp-service-card [service]="service" /> }</div> }
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
  readonly filtered = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('pt-BR');
    return this.services().filter((service) =>
      (!this.category() || service.categoryId === this.category()) &&
      (!query || `${service.name} ${service.description}`.toLocaleLowerCase('pt-BR').includes(query))
    );
  });

  ngOnInit(): void {
    this.searchChanges.pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe((value) => this.syncUrl(value));
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(([path, query]) => {
      this.categorySlug.set(path.get('category') ?? '');
      this.query.set(query.get('q') ?? '');
      this.resolveCategoryFromUrl();
      this.updateSeo();
    });
    this.load();
  }
  load(): void {
    this.loading.set(true); this.error.set('');
    forkJoin({ services: this.marketplace.services(), categories: this.marketplace.categories() }).subscribe({
      next: ({ services, categories }) => { this.services.set(services); this.categories.set(categories); this.resolveCategoryFromUrl(); this.updateSeo(); this.loading.set(false); },
      error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); }
    });
  }
  setQuery(value: string): void { this.query.set(value); this.searchChanges.next(value.trim()); }
  selectCategory(id: string): void { this.category.set(id); this.syncUrl(); }
  private resolveCategoryFromUrl(): void {
    const selected = this.categories().find((item) => item.slug === this.categorySlug());
    this.category.set(selected?.id ?? '');
  }

  private syncUrl(query = this.query()): void {
    const selected = this.categories().find((item) => item.id === this.category());
    void this.router.navigate(selected ? categoryPublicPath(selected) : ['/servicos'], {
      queryParams: { q: query || null },
      replaceUrl: true
    });
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
