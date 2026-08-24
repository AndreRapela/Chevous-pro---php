import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
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
        <label>Serviço<select [(ngModel)]="serviceId"><option value="">Todos os serviços</option>@for (service of services(); track service.id) { <option [value]="service.id">{{ service.name }}</option> }</select></label>
        <label>Cidade<input [(ngModel)]="city" placeholder="Ex.: São Paulo"></label>
        <fieldset><legend>Avaliação mínima</legend><div class="radio-stack"><label><input type="radio" name="rating" [(ngModel)]="minRating" [value]="0"> Todas</label><label><input type="radio" name="rating" [(ngModel)]="minRating" [value]="4.8"> 4,8+</label><label><input type="radio" name="rating" [(ngModel)]="minRating" [value]="4.9"> 4,9+</label></div></fieldset>
      </aside>
      <div class="results-column"><div class="results-heading"><h2>{{ filteredProviders().length }} profissionais</h2><select aria-label="Ordenar resultados" [(ngModel)]="sort"><option value="recommended">Recomendados</option><option value="rating">Melhor avaliação</option><option value="price">Menor preço</option></select></div>
        @if (loading()) { <cvp-state-panel kind="loading" /> }
        @else if (error()) { <cvp-state-panel kind="error" title="Não conseguimos buscar profissionais" [message]="error()" (retry)="load()" /> }
        @else if (!filteredProviders().length) { <cvp-state-panel kind="empty" title="Nenhum profissional com esses filtros" message="Amplie a cidade, serviço ou avaliação para ver mais opções." /> }
        @else { <div class="provider-grid provider-list">@for (provider of filteredProviders(); track provider.id) { <cvp-provider-card [provider]="provider" /> }</div> }
      </div>
    </div></section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfessionalsComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  readonly providers = signal<ProviderProfile[]>([]);
  readonly services = signal<Service[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  serviceId = ''; city = ''; minRating = 0; sort = 'recommended';
  filteredProviders(): ProviderProfile[] {
    let result = this.providers().filter((provider) =>
      (!this.serviceId || !provider.serviceIds.length || provider.serviceIds.includes(this.serviceId)) &&
      (!this.city || provider.city.toLocaleLowerCase('pt-BR').includes(this.city.toLocaleLowerCase('pt-BR'))) &&
      provider.rating >= this.minRating
    );
    if (this.sort === 'rating') result = [...result].sort((a, b) => b.rating - a.rating);
    if (this.sort === 'price') result = [...result].sort((a, b) => a.priceFromCents - b.priceFromCents);
    return result;
  }
  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set('');
    forkJoin({ providers: this.marketplace.providers(), services: this.marketplace.services() }).subscribe({
      next: ({ providers, services }) => { this.providers.set(providers); this.services.set(services); this.loading.set(false); },
      error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); }
    });
  }
  clearFilters(): void { this.serviceId = ''; this.city = ''; this.minRating = 0; this.sort = 'recommended'; }
}
