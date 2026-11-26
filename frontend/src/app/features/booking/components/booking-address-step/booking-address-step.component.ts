import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { EMPTY, catchError, map, of, switchMap, timer } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Address } from '../../../../core/models';
import { POSTAL_CODE_PATTERN, formatPostalCode, isBrazilianPostalCode, postalCodeDigits } from '../../../../shared/utils/postal-code.util';
import { BookingForm } from '../../models/booking-form.model';

@Component({
  selector: 'cvp-booking-address-step',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="wizard-step" [formGroup]="form.controls.address" aria-labelledby="step-address-title">
      <span class="eyebrow">Local do atendimento</span><h1 id="step-address-title" tabindex="-1">Onde o serviço será realizado?</h1><p>O endereço completo só será compartilhado depois da confirmação.</p>
      @if (addresses.length) {
        <fieldset class="saved-addresses"><legend>Endereços salvos</legend><div class="saved-address-list">@for (address of addresses; track address.id) { <button type="button" class="saved-address-option" [class.active]="selected(address)" [attr.aria-pressed]="selected(address)" (click)="useAddress(address)"><span><strong>@if (address.label) { <span data-cvp-no-localize>{{ address.label }}</span> } @else { Endereço }</strong>@if (address.isDefault) { <small>Principal</small> }</span><span data-cvp-no-localize>{{ address.street }}, {{ address.number }} · {{ address.postalCode }} {{ address.city }}</span></button> }</div></fieldset>
        <div class="form-divider"><span>ou informe outro endereço</span></div>
      }
      <div class="form-grid">
        <label>Código postal<input formControlName="postalCode" inputmode="numeric" autocomplete="postal-code" placeholder="1000" maxlength="9" [attr.aria-invalid]="invalid('postalCode')" aria-describedby="postal-code-feedback">@if (invalid('postalCode')) { <small class="field-error" role="alert">Informe um código postal de 4 dígitos ou um CEP de 8 dígitos.</small> }<small id="postal-code-feedback" [class.field-error]="postalError()" role="status">{{ postalLoading() ? 'Consultando o código postal…' : postalError() || postalSuccess() }}</small></label>
        <label class="span-two">Rua<input formControlName="street" autocomplete="address-line1" [attr.aria-invalid]="invalid('street')" [attr.aria-describedby]="invalid('street') ? 'street-error' : null">@if (invalid('street')) { <small id="street-error" class="field-error" role="alert">Informe a rua.</small> }</label>
        <label>Número<input formControlName="number" inputmode="numeric" autocomplete="address-line2" [attr.aria-invalid]="invalid('number')" [attr.aria-describedby]="invalid('number') ? 'number-error' : null">@if (invalid('number')) { <small id="number-error" class="field-error" role="alert">Informe o número.</small> }</label>
        <label>Complemento <span class="optional">Opcional</span><input formControlName="complement" autocomplete="address-line3"></label>
        <label>Cidade<input formControlName="city" autocomplete="address-level2" [attr.list]="postalLocalities().length ? 'booking-postal-localities' : null" [attr.aria-invalid]="invalid('city')" [attr.aria-describedby]="invalid('city') ? 'city-error' : null">@if (invalid('city')) { <small id="city-error" class="field-error" role="alert">Informe a cidade.</small> }</label>
        <datalist id="booking-postal-localities">@for (city of postalLocalities(); track city) { <option [value]="city"></option> }</datalist>
        @if (isBrazilianPostalCode(form.controls.address.controls.postalCode.value)) {
          <label>Bairro<input formControlName="neighborhood" autocomplete="address-level3" required [attr.aria-invalid]="invalid('neighborhood')" [attr.aria-describedby]="invalid('neighborhood') ? 'neighborhood-error' : null">@if (invalid('neighborhood')) { <small id="neighborhood-error" class="field-error" role="alert">Informe o bairro.</small> }</label>
          <label>Estado<select formControlName="state" autocomplete="address-level1" required [attr.aria-invalid]="invalid('state')" [attr.aria-describedby]="invalid('state') ? 'state-error' : null"><option value="">Selecione</option>@for (state of states; track state) { <option [value]="state">{{ state }}</option> }</select>@if (invalid('state')) { <small id="state-error" class="field-error" role="alert">Selecione o estado.</small> }</label>
        }
      </div>
      <div class="privacy-note"><span aria-hidden="true">◇</span><div><strong>Seus dados protegidos</strong><p>Mostramos apenas a região ao profissional até a reserva ser confirmada.</p></div></div>
    </section>
  `,
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingAddressStepComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly destroyRef = inject(DestroyRef);
  @Input({ required: true }) form!: BookingForm;
  @Input() addresses: Address[] = [];
  readonly states = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  readonly postalLoading = signal(false);
  readonly postalError = signal('');
  readonly postalSuccess = signal('');
  readonly postalLocalities = signal<string[]>([]);
  readonly isBrazilianPostalCode = isBrazilianPostalCode;

  ngOnInit(): void {
    const control = this.form.controls.address.controls.postalCode;
    control.setValue(formatPostalCode(control.value), { emitEvent: false });
    control.valueChanges.pipe(
      switchMap((value) => {
        const formatted = formatPostalCode(value);
        if (formatted !== value) control.setValue(formatted, { emitEvent: false });
        this.postalError.set('');
        this.postalSuccess.set('');
        this.postalLocalities.set([]);
        if (!POSTAL_CODE_PATTERN.test(formatted)) {
          this.postalLoading.set(false);
          return EMPTY;
        }
        this.postalLoading.set(true);
        return timer(250).pipe(
          switchMap(() => this.marketplace.lookupPostalCode(formatted)),
          map((address) => ({ code: postalCodeDigits(formatted), address, error: '' })),
          catchError((failure: Error) => of({ code: postalCodeDigits(formatted), address: null, error: failure.message || 'Não foi possível consultar o código postal.' }))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ code, address, error }) => {
      if (code !== postalCodeDigits(control.value)) return;
      this.postalLoading.set(false);
      if (!address) { this.postalError.set(error); return; }
      this.postalLocalities.set(address.localities ?? []);
      this.form.controls.address.patchValue({
        street: address.street || this.form.controls.address.controls.street.value,
        neighborhood: code.length === 4 ? '' : address.neighborhood || this.form.controls.address.controls.neighborhood.value,
        city: address.city || this.form.controls.address.controls.city.value,
        state: code.length === 4 ? '' : address.state || this.form.controls.address.controls.state.value
      });
      this.postalSuccess.set(code.length === 4 ? 'Confira a cidade e informe a rua e o número.' : 'Endereço encontrado. Confira os dados e informe o número.');
    });
  }

  useAddress(address: Address): void {
    this.form.controls.address.patchValue({ postalCode: formatPostalCode(address.postalCode), street: address.street, number: address.number, complement: address.complement ?? '', neighborhood: address.neighborhood, city: address.city, state: address.state }, { emitEvent: false });
    this.postalError.set('');
    this.postalSuccess.set('');
    this.postalLoading.set(false);
    this.postalLocalities.set([]);
  }

  selected(address: Address): boolean {
    const value = this.form.controls.address.getRawValue();
    const normalizePostalCode = (item: string | undefined) => (item ?? '').replace(/\D+/g, '');
    return normalizePostalCode(value.postalCode) === normalizePostalCode(address.postalCode)
      && value.street.trim().toLowerCase() === address.street.trim().toLowerCase()
      && value.number.trim().toLowerCase() === address.number.trim().toLowerCase()
      && value.complement.trim().toLowerCase() === (address.complement ?? '').trim().toLowerCase()
      && value.city.trim().toLowerCase() === address.city.trim().toLowerCase();
  }

  invalid(name: keyof BookingForm['controls']['address']['controls']): boolean {
    const control = this.form.controls.address.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }
}
