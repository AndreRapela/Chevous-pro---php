import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, map, of, switchMap } from 'rxjs';
import { LocalizationService } from '../../../../core/localization/localization.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Address } from '../../../../core/models';
import {
  AccountIdentityComponent,
  AccountSecurityComponent,
  PageHeaderComponent
} from '../../../../shared/components';
import { formatPostalCode, postalCodeDigits } from '../../../../shared/utils/postal-code.util';

@Component({
  selector: 'cvp-customer-profile',
  standalone: true,
  imports: [
    AccountIdentityComponent,
    AccountSecurityComponent,
    PageHeaderComponent,
    ReactiveFormsModule
  ],
  templateUrl: './customer-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly marketplace = inject(MarketplaceService);
  readonly localization = inject(LocalizationService);
  readonly saved = signal(false);
  readonly error = signal('');
  readonly postalLoading = signal(false);
  readonly postalError = signal('');
  readonly postalSuccess = signal('');
  readonly addresses = signal<Address[]>([]);
  readonly addressesLoading = signal(true);
  readonly addressSaving = signal(false);
  readonly editingAddressId = signal('');
  readonly removeTarget = signal('');
  readonly addressForm = this.fb.nonNullable.group({
    label: [
      this.localization.translate('Casa'),
      [Validators.required, Validators.minLength(2), Validators.maxLength(60)]
    ],
    postalCode: ['', [Validators.required, Validators.pattern(/^\d{5}-\d{3}$/)]],
    street: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(180)]],
    number: ['', [Validators.required, Validators.maxLength(20)]],
    complement: ['', Validators.maxLength(100)],
    neighborhood: ['', [Validators.required, Validators.maxLength(100)]],
    city: [this.auth.user()?.city || 'São Paulo', [Validators.required, Validators.maxLength(100)]],
    state: ['SP', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
    isDefault: [false]
  });

  ngOnInit(): void {
    this.loadAddresses();
    const control = this.addressForm.controls.postalCode;
    control.valueChanges
      .pipe(
        switchMap((value) => {
          const formatted = formatPostalCode(value);
          if (formatted !== value) control.setValue(formatted, { emitEvent: false });
          this.postalError.set('');
          this.postalSuccess.set('');
          if (postalCodeDigits(formatted).length !== 8) {
            this.postalLoading.set(false);
            return EMPTY;
          }
          this.postalLoading.set(true);
          return this.marketplace.lookupPostalCode(formatted).pipe(
            map((address) => ({ code: postalCodeDigits(formatted), address, error: '' })),
            catchError((failure: Error) =>
              of({
                code: postalCodeDigits(formatted),
                address: null,
                error: failure.message || 'Não foi possível consultar o CEP.'
              })
            )
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ code, address, error }) => {
        if (code !== postalCodeDigits(control.value)) return;
        this.postalLoading.set(false);
        if (!address) {
          this.postalError.set(error);
          return;
        }
        this.addressForm.patchValue({
          street: address.street || this.addressForm.controls.street.value,
          neighborhood: address.neighborhood || this.addressForm.controls.neighborhood.value,
          city: address.city || this.addressForm.controls.city.value,
          state: address.state || this.addressForm.controls.state.value
        });
        this.postalSuccess.set('Endereço encontrado. Confira os dados e informe o número.');
      });
  }

  loadAddresses(): void {
    this.addressesLoading.set(true);
    this.marketplace.addresses().subscribe({
      next: (addresses) => {
        this.addresses.set(addresses);
        this.addressesLoading.set(false);
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.addressesLoading.set(false);
      }
    });
  }

  editAddress(address: Address): void {
    this.editingAddressId.set(address.id || '');
    this.addressForm.reset(
      {
        label: address.label || this.localization.translate('Casa'),
        postalCode: formatPostalCode(address.postalCode),
        street: address.street,
        number: address.number,
        complement: address.complement || '',
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        isDefault: !!address.isDefault
      },
      { emitEvent: false }
    );
    this.postalError.set('');
    this.postalSuccess.set('');
    this.postalLoading.set(false);
  }

  resetAddressForm(): void {
    this.editingAddressId.set('');
    this.removeTarget.set('');
    this.addressForm.reset(
      {
        label: this.localization.translate('Casa'),
        postalCode: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: this.auth.user()?.city || 'São Paulo',
        state: 'SP',
        isDefault: false
      },
      { emitEvent: false }
    );
    this.postalError.set('');
    this.postalSuccess.set('');
    this.postalLoading.set(false);
  }

  saveAddress(): void {
    this.addressForm.markAllAsTouched();
    if (this.addressForm.invalid || this.addressSaving()) return;
    const raw = this.addressForm.getRawValue();
    const payload: Address = {
      ...raw,
      label: raw.label.trim(),
      postalCode: raw.postalCode.trim(),
      street: raw.street.trim(),
      number: raw.number.trim(),
      complement: raw.complement.trim() || undefined,
      neighborhood: raw.neighborhood.trim(),
      city: raw.city.trim(),
      state: raw.state.trim().toUpperCase()
    };
    const request = this.editingAddressId()
      ? this.marketplace.updateAddress(this.editingAddressId(), payload)
      : this.marketplace.createAddress(payload);
    this.addressSaving.set(true);
    this.error.set('');
    request.subscribe({
      next: (address) => {
        this.addresses.update((items) => {
          const updated = raw.isDefault
            ? items.map((item) => ({ ...item, isDefault: false }))
            : items;
          return this.editingAddressId()
            ? updated.map((item) => (item.id === address.id ? address : item))
            : [address, ...updated];
        });
        this.saved.set(true);
        this.addressSaving.set(false);
        this.resetAddressForm();
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.addressSaving.set(false);
      }
    });
  }

  removeAddress(address: Address): void {
    if (!address.id || this.addressSaving()) return;
    this.addressSaving.set(true);
    this.error.set('');
    this.marketplace.removeAddress(address.id).subscribe({
      next: () => {
        this.addresses.update((items) => items.filter((item) => item.id !== address.id));
        this.removeTarget.set('');
        this.addressSaving.set(false);
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.addressSaving.set(false);
      }
    });
  }
}
