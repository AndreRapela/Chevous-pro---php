import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Product } from '../../../../core/models';
import { BrandComponent, StatePanelComponent } from '../../../../shared/components';
import { LocalizedMoneyPipe } from '../../../../shared/localization/localized-format.pipe';
import {
  cardBrand,
  checkoutTotalCents,
  formatCardNumber,
  formatExpiry,
  isValidCardNumber,
  isValidExpiry,
  paymentDigits
} from '../../utils/payment-form.util';

type PaymentMethod = 'card' | 'pix';

const cardNumberValidator: ValidatorFn = (control: AbstractControl<string>): ValidationErrors | null =>
  !control.value || isValidCardNumber(control.value) ? null : { cardNumber: true };

const expiryValidator: ValidatorFn = (control: AbstractControl<string>): ValidationErrors | null =>
  !control.value || isValidExpiry(control.value) ? null : { expiry: true };

@Component({
  selector: 'cvp-payment',
  standalone: true,
  imports: [BrandComponent, LocalizedMoneyPipe, ReactiveFormsModule, RouterLink, StatePanelComponent],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private completionTimer?: ReturnType<typeof setTimeout>;

  readonly product = signal<Product | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly method = signal<PaymentMethod>('card');
  readonly quantity = signal(1);
  readonly processing = signal(false);
  readonly completed = signal(false);
  readonly orderCode = signal('');
  readonly totalCents = computed(() => checkoutTotalCents(this.product()?.priceCents ?? 0, this.quantity()));
  readonly detectedBrand = computed(() => cardBrand(this.cardForm.controls.number.value));

  readonly deliveryForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    postalCode: ['', [Validators.required, Validators.pattern(/^\d{5}-?\d{3}$/)]],
    street: ['', [Validators.required, Validators.maxLength(150)]],
    number: ['', [Validators.required, Validators.maxLength(20)]],
    complement: ['', Validators.maxLength(80)],
    city: ['', [Validators.required, Validators.maxLength(100)]],
    state: ['', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]]
  });

  readonly cardForm = this.fb.nonNullable.group({
    holder: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    number: ['', [Validators.required, cardNumberValidator]],
    expiry: ['', [Validators.required, expiryValidator]],
    cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]]
  });

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      if (this.completionTimer) clearTimeout(this.completionTimer);
    });
    this.load();
  }

  load(): void {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.loading.set(true);
    this.error.set('');
    this.marketplace.products().subscribe({
      next: (products) => {
        const product = products.find((item) => item.slug === slug || item.id === slug) ?? null;
        this.product.set(product);
        this.loading.set(false);
        if (!product) this.error.set('Produto indisponível para pagamento.');
      },
      error: (failure: Error) => {
        this.error.set(failure.message || 'Não foi possível preparar o pagamento.');
        this.loading.set(false);
      }
    });
  }

  selectMethod(method: PaymentMethod): void {
    this.method.set(method);
  }

  updateQuantity(change: number): void {
    const maximum = Math.max(1, Math.min(10, this.product()?.inventoryCount ?? 1));
    this.quantity.update((value) => Math.max(1, Math.min(maximum, value + change)));
  }

  cardNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatCardNumber(input.value);
    input.value = formatted;
    this.cardForm.controls.number.setValue(formatted);
  }

  expiryInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatExpiry(input.value);
    input.value = formatted;
    this.cardForm.controls.expiry.setValue(formatted);
  }

  cvvInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = paymentDigits(input.value).slice(0, 4);
    input.value = formatted;
    this.cardForm.controls.cvv.setValue(formatted);
  }

  submit(): void {
    if (this.processing() || !this.product()) return;
    this.deliveryForm.markAllAsTouched();
    if (this.method() === 'card') this.cardForm.markAllAsTouched();
    if (this.deliveryForm.invalid || (this.method() === 'card' && this.cardForm.invalid)) return;

    this.processing.set(true);
    this.completionTimer = setTimeout(() => {
      this.orderCode.set(`CVP-${Date.now().toString().slice(-8)}`);
      this.cardForm.reset();
      this.processing.set(false);
      this.completed.set(true);
      queueMicrotask(() => document.querySelector<HTMLElement>('.payment-success h1')?.focus());
    }, 650);
  }
}
