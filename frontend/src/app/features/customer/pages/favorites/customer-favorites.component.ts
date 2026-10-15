import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { ProviderProfile } from '../../../../core/models';
import {
  PageHeaderComponent,
  ProviderCardComponent,
  StatePanelComponent
} from '../../../../shared/components';

@Component({
  selector: 'cvp-customer-favorites',
  standalone: true,
  imports: [PageHeaderComponent, ProviderCardComponent, StatePanelComponent],
  templateUrl: './customer-favorites.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerFavoritesComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  readonly providers = signal<ProviderProfile[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.marketplace.favorites().subscribe({
      next: (providers) => {
        this.providers.set(providers);
        this.loading.set(false);
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.loading.set(false);
      }
    });
  }

  remove(provider: ProviderProfile): void {
    this.marketplace.favorite(provider.id, false).subscribe({
      next: () => this.providers.update((items) => items.filter((item) => item.id !== provider.id)),
      error: (failure: Error) => this.error.set(failure.message)
    });
  }
}
