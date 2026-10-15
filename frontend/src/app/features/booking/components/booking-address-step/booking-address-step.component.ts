import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Input,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { EMPTY, catchError, map, of, switchMap } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Address } from '../../../../core/models';
import { formatPostalCode, postalCodeDigits } from '../../../../shared/utils/postal-code.util';
import { BookingForm } from '../../models/booking-form.model';

@Component({
  selector: 'cvp-booking-address-step',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './booking-address-step.component.html',
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingAddressStepComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly destroyRef = inject(DestroyRef);
  @Input({ required: true }) form!: BookingForm;
  @Input() addresses: Address[] = [];
  readonly states = [
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO'
  ];
  readonly postalLoading = signal(false);
  readonly postalError = signal('');
  readonly postalSuccess = signal('');

  ngOnInit(): void {
    const control = this.form.controls.address.controls.postalCode;
    control.setValue(formatPostalCode(control.value), { emitEvent: false });
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
        this.form.controls.address.patchValue({
          street: address.street || this.form.controls.address.controls.street.value,
          neighborhood:
            address.neighborhood || this.form.controls.address.controls.neighborhood.value,
          city: address.city || this.form.controls.address.controls.city.value,
          state: address.state || this.form.controls.address.controls.state.value
        });
        this.postalSuccess.set('Endereço encontrado. Confira os dados e informe o número.');
      });
  }

  useAddress(address: Address): void {
    this.form.controls.address.patchValue(
      {
        postalCode: formatPostalCode(address.postalCode),
        street: address.street,
        number: address.number,
        complement: address.complement ?? '',
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state
      },
      { emitEvent: false }
    );
    this.postalError.set('');
    this.postalSuccess.set('');
  }

  selected(address: Address): boolean {
    const value = this.form.controls.address.getRawValue();
    const normalizePostalCode = (item: string | undefined) => (item ?? '').replace(/\D+/g, '');
    return (
      normalizePostalCode(value.postalCode) === normalizePostalCode(address.postalCode) &&
      value.street.trim().toLowerCase() === address.street.trim().toLowerCase() &&
      value.number.trim().toLowerCase() === address.number.trim().toLowerCase()
    );
  }

  invalid(name: keyof BookingForm['controls']['address']['controls']): boolean {
    const control = this.form.controls.address.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }
}
