import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { ProviderProfile } from '../../../../core/models';
import { PageHeaderComponent, ProviderCardComponent, StatePanelComponent } from '../../../../shared/components';

@Component({
  selector: 'cvp-customer-favorites',
  standalone: true,
  imports: [PageHeaderComponent, ProviderCardComponent, StatePanelComponent],
  template: `
    <section class="portal-page customer-favorites-page">
      <cvp-page-header eyebrow="Sua seleção" title="Profissionais favoritos" description="Encontre rapidamente quem já conquistou sua confiança." />
      @if (loading()) { <cvp-state-panel kind="loading" /> }
      @else if (error()) { <cvp-state-panel kind="error" title="Favoritos indisponíveis" [message]="error()" (retry)="load()" /> }
      @else if (!providers().length) { <cvp-state-panel kind="empty" title="Nenhum favorito ainda" message="Toque no coração de um perfil para salvá-lo aqui." /> }
      @else { <div class="provider-grid">@for (provider of providers(); track provider.id) { <div><cvp-provider-card [provider]="provider" /><button class="text-button" type="button" (click)="remove(provider)" [attr.aria-label]="'Remover ' + provider.name + ' dos favoritos'">Remover dos favoritos</button></div> }</div> }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerFavoritesComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  readonly providers = signal<ProviderProfile[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.marketplace.favorites().subscribe({
      next: (providers) => { this.providers.set(providers); this.loading.set(false); },
      error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); }
    });
  }

  remove(provider: ProviderProfile): void {
    this.marketplace.favorite(provider.id, false).subscribe({
      next: () => this.providers.update((items) => items.filter((item) => item.id !== provider.id)),
      error: (failure: Error) => this.error.set(failure.message)
    });
  }
}
