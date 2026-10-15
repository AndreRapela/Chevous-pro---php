import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { ProviderRequest } from '../../../../core/models';
import { LocalizationService } from '../../../../core/localization/localization.service';
import {
  displayReferenceAmount,
  displayReferenceBound,
  referenceAmountToCents
} from '../../../../core/localization/reference-currency.util';
import { PageHeaderComponent, StatePanelComponent } from '../../../../shared/components';
import {
  LocalizedDatePipe,
  LocalizedMoneyPipe
} from '../../../../shared/localization/localized-format.pipe';

@Component({
  selector: 'cvp-provider-requests',
  standalone: true,
  imports: [LocalizedDatePipe, LocalizedMoneyPipe, PageHeaderComponent, StatePanelComponent],
  templateUrl: './provider-requests.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProviderRequestsComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  readonly localization = inject(LocalizationService);
  readonly requests = signal<ProviderRequest[]>([]);
  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly loadError = signal('');
  readonly actionError = signal('');
  readonly success = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.marketplace.providerOpenRequests().subscribe({
      next: (requests) => {
        this.requests.set(requests);
        this.loading.set(false);
      },
      error: (failure: Error) => {
        this.loadError.set(failure.message);
        this.loading.set(false);
      }
    });
  }

  offer(request: ProviderRequest, amount: string, message: string): void {
    if (this.acting()) return;
    // An untouched rounded display value must not change the API reference by a few cents.
    const cents =
      amount.trim() && Number(amount) === this.displayAmount(request)
        ? request.suggestedSubtotalCents
        : referenceAmountToCents(amount, this.localization.currency(), request.currency);
    // Same source-currency limits enforced by ProviderController::createOffer.
    if (!Number.isFinite(cents) || cents < 1000 || cents > 10000000) {
      this.actionError.set('Informe um valor de proposta válido.');
      return;
    }
    this.acting.set(true);
    this.actionError.set('');
    this.marketplace.createOffer(request.id, cents, message.trim()).subscribe({
      next: () => {
        this.requests.update((items) => items.filter((item) => item.id !== request.id));
        this.success.set('Proposta enviada.');
        this.acting.set(false);
      },
      error: (failure: Error) => {
        this.actionError.set(failure.message);
        this.acting.set(false);
      }
    });
  }

  initials(value: string): string {
    return value
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase();
  }

  displayAmount(request: ProviderRequest): number {
    return displayReferenceAmount(
      request.suggestedSubtotalCents,
      request.currency,
      this.localization.currency()
    );
  }

  minimumAmount(request: ProviderRequest): number {
    return displayReferenceBound(1000, request.currency, this.localization.currency(), 'minimum');
  }

  maximumAmount(request: ProviderRequest): number {
    return displayReferenceBound(
      10000000,
      request.currency,
      this.localization.currency(),
      'maximum'
    );
  }
}
