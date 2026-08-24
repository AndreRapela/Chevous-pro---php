import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Service, ServiceCategory } from '../../../../core/models';
import { ServiceCardComponent, StatePanelComponent } from '../../../../shared/components';

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
  readonly services = signal<Service[]>([]);
  readonly categories = signal<ServiceCategory[]>([]);
  readonly query = signal('');
  readonly category = signal('');
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
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.query.set(params.get('q') ?? '');
      this.category.set(params.get('categoria') ?? '');
    });
    this.load();
  }
  load(): void {
    this.loading.set(true); this.error.set('');
    forkJoin({ services: this.marketplace.services(), categories: this.marketplace.categories() }).subscribe({
      next: ({ services, categories }) => { this.services.set(services); this.categories.set(categories); this.loading.set(false); },
      error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); }
    });
  }
  setQuery(value: string): void { this.query.set(value); this.syncUrl(); }
  selectCategory(id: string): void { this.category.set(id); this.syncUrl(); }
  private syncUrl(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: this.query() || null, categoria: this.category() || null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
