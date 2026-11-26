import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, combineLatest, exhaustMap, take, takeWhile, timer } from 'rxjs';
import { ProductCheckoutQuote, ProductOrder, ProductOrderService } from '../../../../core/data-access/product-order.service';
import { AppCurrency, LocalizationService } from '../../../../core/localization/localization.service';
import { ApiClientError } from '../../../../core/models';
import { BrandComponent, StatePanelComponent } from '../../../../shared/components';
import { checkoutTotalCents, stripeCheckoutUrl } from '../../utils/payment-form.util';

@Component({
  selector: 'cvp-payment',
  standalone: true,
  imports: [BrandComponent, RouterLink, StatePanelComponent],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentComponent implements OnInit {
  private readonly orders = inject(ProductOrderService);
  private readonly route = inject(ActivatedRoute);
  private readonly localization = inject(LocalizationService);
  private readonly destroyRef = inject(DestroyRef);
  private lookup?: Subscription;
  private readonly checkoutKey = signal<string | undefined>(undefined);
  private slug = '';
  private orderId = '';
  readonly quote = signal<ProductCheckoutQuote | null>(null);
  readonly order = signal<ProductOrder | null>(null);
  readonly loading = signal(true);
  readonly lookupError = signal('');
  readonly checkoutError = signal('');
  readonly quantity = signal(1);
  readonly processing = signal(false);
  readonly cancelled = signal(false);
  readonly canRetryCheckout = computed(() => this.checkoutKey() !== undefined);
  readonly subtotal = computed(() => checkoutTotalCents(this.quote()?.unitCents ?? 0, this.quantity()));
  readonly totalCents = computed(() => this.subtotal() + (this.quote()?.shippingCents ?? 0));

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, query]) => {
        this.slug = params.get('slug') ?? '';
        this.orderId = query.get('pedido') ?? '';
        this.cancelled.set(query.get('cancelado') === '1');
        this.quantity.set(1);
        this.checkoutKey.set(undefined);
        this.quote.set(null);
        this.order.set(null);
        this.load();
      });
  }

  load(): void {
    this.lookup?.unsubscribe();
    this.loading.set(!this.order());
    this.lookupError.set('');
    this.checkoutError.set('');
    if (this.orderId) {
      this.lookup = timer(0, 2500).pipe(
        exhaustMap(() => this.orders.order(this.orderId)),
        takeWhile((order) => order.status === 'pending' && !this.cancelled(), true),
        take(10),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (order) => { this.order.set(order); this.loading.set(false); },
        error: (failure: Error) => this.failLookup(failure),
      });
      return;
    }
    this.lookup = this.orders.quote(this.slug, this.localization.currency()).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (quote) => {
          const previous = this.quote();
          if (previous?.unitCents !== quote.unitCents || previous.shippingCents !== quote.shippingCents || previous.currency !== quote.currency) {
            this.checkoutKey.set(undefined);
          }
          this.quote.set(quote);
          if (!this.canRetryCheckout()) {
            this.quantity.update((value) => Math.max(1, Math.min(value, quote.available)));
          }
          this.loading.set(false);
        },
        error: (failure: Error) => this.failLookup(failure),
      });
  }

  updateQuantity(change: number): void {
    const maximum = this.quote()?.available ?? 1;
    this.quantity.update((value) => Math.max(1, Math.min(maximum, value + change)));
    this.checkoutKey.set(undefined);
    this.checkoutError.set('');
  }

  submit(): void {
    const quote = this.quote();
    if (!quote?.enabled || (quote.available < 1 && !this.canRetryCheckout()) || this.processing()) return;
    this.processing.set(true);
    this.checkoutError.set('');
    const checkoutKey = this.checkoutKey() ?? crypto.randomUUID();
    this.checkoutKey.set(checkoutKey);
    this.orders.start(quote, this.quantity(), this.totalCents(), this.localization.language(), checkoutKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => {
          const url = stripeCheckoutUrl(session.checkoutUrl);
          if (url) window.location.assign(url);
          else this.failCheckout('Não foi possível abrir a página de pagamento.');
        },
        error: (failure: Error) => {
          if (failure instanceof ApiClientError && failure.status >= 400 && failure.status < 500 && failure.status !== 429) {
            this.checkoutKey.set(undefined);
          }
          this.failCheckout(failure.message);
        },
      });
  }

  money(cents: number, currency: AppCurrency): string {
    return new Intl.NumberFormat(this.localization.locale(), { style: 'currency', currency }).format(cents / 100);
  }

  private failLookup(failure: Error): void {
    this.lookupError.set(failure.message);
    this.loading.set(false);
  }

  private failCheckout(message: string): void {
    this.checkoutError.set(message);
    this.processing.set(false);
  }
}
