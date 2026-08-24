import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Address } from '../../../../core/models';
import { BookingForm } from '../../models/booking-form.model';

@Component({
  selector: 'cvp-booking-address-step',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="wizard-step" [formGroup]="form.controls.address" aria-labelledby="step-address-title">
      <span class="eyebrow">Local do atendimento</span><h1 id="step-address-title" tabindex="-1">Onde o serviço será realizado?</h1><p>O endereço completo só será compartilhado depois da confirmação.</p>
      @if (addresses.length) {
        <fieldset class="saved-addresses"><legend>Endereços salvos</legend><div class="saved-address-list">@for (address of addresses; track address.id) { <button type="button" class="saved-address-option" [class.active]="selected(address)" [attr.aria-pressed]="selected(address)" (click)="useAddress(address)"><span><strong>{{ address.label || 'Endereço' }}</strong>@if (address.isDefault) { <small>Principal</small> }</span><span>{{ address.street }}, {{ address.number }} · {{ address.neighborhood }}</span></button> }</div></fieldset>
        <div class="form-divider"><span>ou informe outro endereço</span></div>
      }
      <div class="form-grid">
        <label>CEP<input formControlName="postalCode" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" [attr.aria-invalid]="invalid('postalCode')" [attr.aria-describedby]="invalid('postalCode') ? 'postal-code-error' : null">@if (invalid('postalCode')) { <small id="postal-code-error" class="field-error" role="alert">Informe o CEP.</small> }</label>
        <label class="span-two">Rua<input formControlName="street" autocomplete="address-line1" [attr.aria-invalid]="invalid('street')" [attr.aria-describedby]="invalid('street') ? 'street-error' : null">@if (invalid('street')) { <small id="street-error" class="field-error" role="alert">Informe a rua.</small> }</label>
        <label>Número<input formControlName="number" inputmode="numeric" autocomplete="address-line2" [attr.aria-invalid]="invalid('number')" [attr.aria-describedby]="invalid('number') ? 'number-error' : null">@if (invalid('number')) { <small id="number-error" class="field-error" role="alert">Informe o número.</small> }</label>
        <label>Complemento <span class="optional">Opcional</span><input formControlName="complement" autocomplete="address-line3"></label>
        <label>Bairro<input formControlName="neighborhood" autocomplete="address-level3" [attr.aria-invalid]="invalid('neighborhood')" [attr.aria-describedby]="invalid('neighborhood') ? 'neighborhood-error' : null">@if (invalid('neighborhood')) { <small id="neighborhood-error" class="field-error" role="alert">Informe o bairro.</small> }</label>
        <label>Cidade<input formControlName="city" autocomplete="address-level2" [attr.aria-invalid]="invalid('city')" [attr.aria-describedby]="invalid('city') ? 'city-error' : null">@if (invalid('city')) { <small id="city-error" class="field-error" role="alert">Informe a cidade.</small> }</label>
        <label>Estado<select formControlName="state" autocomplete="address-level1" [attr.aria-invalid]="invalid('state')" [attr.aria-describedby]="invalid('state') ? 'state-error' : null"><option value="">Selecione</option><option value="SP">SP</option><option value="RJ">RJ</option><option value="MG">MG</option><option value="PR">PR</option><option value="SC">SC</option><option value="RS">RS</option><option value="BA">BA</option><option value="PE">PE</option><option value="DF">DF</option></select>@if (invalid('state')) { <small id="state-error" class="field-error" role="alert">Selecione o estado.</small> }</label>
      </div>
      <div class="privacy-note"><span aria-hidden="true">◇</span><div><strong>Seus dados protegidos</strong><p>Mostramos apenas a região ao profissional até a reserva ser confirmada.</p></div></div>
    </section>
  `,
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingAddressStepComponent {
  @Input({ required: true }) form!: BookingForm;
  @Input() addresses: Address[] = [];

  useAddress(address: Address): void {
    this.form.controls.address.patchValue({ postalCode: address.postalCode, street: address.street, number: address.number, complement: address.complement ?? '', neighborhood: address.neighborhood, city: address.city, state: address.state });
  }

  selected(address: Address): boolean {
    const value = this.form.controls.address.getRawValue();
    const normalizePostalCode = (item: string | undefined) => (item ?? '').replace(/\D+/g, '');
    return normalizePostalCode(value.postalCode) === normalizePostalCode(address.postalCode)
      && value.street.trim().toLowerCase() === address.street.trim().toLowerCase()
      && value.number.trim().toLowerCase() === address.number.trim().toLowerCase();
  }

  invalid(name: keyof BookingForm['controls']['address']['controls']): boolean {
    const control = this.form.controls.address.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }
}
