import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, catchError, debounceTime, of, startWith, switchMap, tap } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { ProviderProfile, Service } from '../../../../core/models';
import { ProviderCardComponent, StatePanelComponent } from '../../../../shared/components';

@Component({
  selector: 'cvp-professionals',
  standalone: true,
  imports: [FormsModule, ProviderCardComponent, StatePanelComponent],
  template: `
    <section class="page-hero compact professionals-hero"><div class="container narrow"><span class="eyebrow">Escolha com confiança</span><h1>Profissionais perto de você</h1><p>Perfis aprovados, avaliações publicadas e disponibilidade clara.</p></div></section>
    <section class="section section-tight professionals-results"><div class="container search-layout">
      <aside class="filters-card professionals-filters" aria-labelledby="filters-title"><div class="filter-title"><h2 id="filters-title">Filtros</h2><button type="button" class="text-button" (click)="clearFilters()">Limpar</button></div>
        <label>Serviço<select [(ngModel)]="serviceId" (ngModelChange)="filtersChanged()"><option value="">Todos os serviços</option>@for (service of services(); track service.id) { <option [value]="service.id">{{ service.name }}</option> }</select></label>
        <label>Cidade<input [(ngModel)]="city" (ngModelChange)="filtersChanged()" placeholder="Ex.: São Paulo" autocomplete="address-level2"></label>
        <fieldset><legend>Avaliação mínima</legend><div class="radio-stack"><label><input type="radio" name="rating" [(ngModel)]="minRating" (ngModelChange)="filtersChanged()" [value]="0"> Todas</label><label><input type="radio" name="rating" [(ngModel)]="minRating" (ngModelChange)="filtersChanged()" [value]="4.8"> 4,8+</label><label><input type="radio" name="rating" [(ngModel)]="minRating" (ngModelChange)="filtersChanged()" [value]="4.9"> 4,9+</label></div></fieldset>
      </aside>
      <div class="results-column"><div class="results-heading"><h2>{{ total() }} profissionais</h2><select aria-label="Ordenar resultados" [(ngModel)]="sort" (ngModelChange)="filtersChanged()"><option value="recommended">Recomendados</option><option value="rating">Melhor avaliação</option><option value="price">Menor preço</option></select></div>
        @if (loading()) { <cvp-state-panel kind="loading" /> }
        @else if (error()) { <cvp-state-panel kind="error" title="Não conseguimos buscar profissionais" [message]="error()" (retry)="load()" /> }
        @else if (!providers().length) { <cvp-state-panel kind="empty" title="Nenhum profissional com esses filtros" message="Amplie a cidade, serviço ou avaliação para ver mais opções." /> }
        @else {
          <div class="provider-grid provider-list">@for (provider of providers(); track provider.id) { <cvp-provider-card [provider]="provider" /> }</div>
          @if (lastPage() > 1) {
            <nav class="result-pagination" aria-label="Paginação de profissionais">
              <span>Mostrando {{ firstVisible() }}–{{ lastVisible() }} de {{ total() }} profissionais</span>
              <div>
                <button class="btn btn-secondary btn-small" type="button" [disabled]="page() === 1" (click)="goToPage(page() - 1)">Anterior</button>
                @for (item of pageNumbers(); track item) { <button class="page-button" type="button" [class.active]="item === page()" [attr.aria-current]="item === page() ? 'page' : null" (click)="goToPage(item)">{{ item }}</button> }
                <button class="btn btn-secondary btn-small" type="button" [disabled]="page() === lastPage()" (click)="goToPage(page() + 1)">Próxima</button>
              </div>
            </nav>
          }
        }
      </div>
    </div></section>
  `,
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
  readonly pageSize = 4;
  readonly pageNumbers = computed(() => {
    const last = this.lastPage();
    const start = Math.max(1, Math.min(this.page() - 2, Math.max(1, last - 4)));
    return Array.from({ length: Math.min(5, last - start + 1) }, (_, index) => start + index);
  });
  serviceId = ''; city = ''; minRating = 0; sort = 'recommended';
  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.serviceId = params.get('servico') ?? '';
    this.city = params.get('cidade') ?? '';
    this.minRating = Number(params.get('nota')) || 0;
    this.sort = params.get('ordenar') ?? 'recommended';
    this.page.set(Math.max(1, Number(params.get('pagina')) || 1));
    this.marketplace.services().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (services) => this.services.set(services) });
    this.filterChanges.pipe(
      startWith(undefined),
      debounceTime(250),
      tap(() => { this.loading.set(true); this.error.set(''); }),
      switchMap(() => this.marketplace.providersPage(this.query(1)).pipe(catchError((failure: Error) => of({ data: [] as ProviderProfile[], meta: {}, failure })))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((response) => {
      const failure = 'failure' in response ? response.failure : undefined;
      if (failure) { this.error.set(failure.message); this.providers.set([]); this.total.set(0); this.loading.set(false); return; }
      this.providers.set(response.data); this.page.set(this.metaNumber(response.meta, 'page', 1)); this.lastPage.set(this.metaNumber(response.meta, 'lastPage', 1)); this.total.set(this.metaNumber(response.meta, 'total', response.data.length)); this.loading.set(false);
    });
  }
  load(): void {
    this.filterChanges.next();
  }
  filtersChanged(): void {
    this.page.set(1);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { servico: this.serviceId || null, cidade: this.city.trim() || null, nota: this.minRating || null, ordenar: this.sort === 'recommended' ? null : this.sort, pagina: null }, queryParamsHandling: 'merge', replaceUrl: true });
    this.filterChanges.next();
  }
  clearFilters(): void { this.serviceId = ''; this.city = ''; this.minRating = 0; this.sort = 'recommended'; this.filtersChanged(); }
  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage() || page === this.page()) return;
    this.page.set(page);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { pagina: page > 1 ? page : null }, queryParamsHandling: 'merge', replaceUrl: true });
    this.filterChanges.next();
  }
  firstVisible(): number { return this.total() ? (this.page() - 1) * this.pageSize + 1 : 0; }
  lastVisible(): number { return Math.min(this.page() * this.pageSize, this.total()); }
  private query(page: number) { return { serviceId: this.serviceId || undefined, city: this.city.trim() || undefined, minRating: this.minRating || undefined, sort: this.sort, page, perPage: this.pageSize }; }
  private metaNumber(meta: Record<string, unknown> | undefined, key: string, fallback: number): number { const value = Number(meta?.[key]); return Number.isFinite(value) && value >= 0 ? value : fallback; }
}
