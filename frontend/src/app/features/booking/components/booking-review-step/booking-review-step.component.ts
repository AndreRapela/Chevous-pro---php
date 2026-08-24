import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ProviderProfile, Service } from '../../../../core/models';
import { BookingForm } from '../../models/booking-form.model';

@Component({
  selector: 'cvp-booking-review-step',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule],
  template: `
    <section class="wizard-step" [formGroup]="form" aria-labelledby="step-payment-title">
      <span class="eyebrow">Última etapa</span><h1 id="step-payment-title" tabindex="-1">Revise e confirme</h1><p>O valor abaixo foi calculado pela plataforma para os detalhes selecionados.</p>
      <section class="review-summary"><h2>Detalhes da reserva</h2><dl><div><dt>Serviço</dt><dd>{{ service.name }}</dd></div><div><dt>Data e horário</dt><dd>{{ scheduledDate | date:'EEEE, d MMM':'':'pt-BR' }}, {{ form.controls.time.value }}</dd></div><div><dt>Profissional</dt><dd>{{ provider?.name }}</dd></div><div><dt>Endereço</dt><dd>{{ form.controls.address.controls.street.value }}, {{ form.controls.address.controls.number.value }} · {{ form.controls.address.controls.neighborhood.value }}</dd></div></dl></section>
      <div class="privacy-note"><span aria-hidden="true">◇</span><div><strong>Pagamento protegido</strong><p>Ao confirmar, criaremos uma intenção de pagamento segura. O método disponível será apresentado pelo provedor de pagamento.</p></div></div>
      <label>Cupom <span class="optional">Opcional</span><div class="input-action"><input formControlName="coupon" placeholder="Digite seu cupom"><button type="button" class="btn btn-secondary" (click)="couponApplied.emit()">Aplicar</button></div>@if (couponMessage) { <small [class.field-success]="couponValid" [class.field-error]="!couponValid">{{ couponMessage }}</small> }</label>
      <label class="check-row terms-check"><input type="checkbox" formControlName="terms"><span>Confirmo os detalhes e aceito as regras de cancelamento.</span></label>@if (termsInvalid) { <small class="field-error">Você precisa aceitar para confirmar.</small> }
    </section>
  `,
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingReviewStepComponent {
  @Input({ required: true }) form!: BookingForm;
  @Input({ required: true }) service!: Service;
  @Input() provider?: ProviderProfile;
  @Input() couponMessage = '';
  @Input() couponValid = false;
  @Output() readonly couponApplied = new EventEmitter<void>();

  get scheduledDate(): string {
    return this.form.controls.date.value ? `${this.form.controls.date.value}T12:00:00` : '';
  }

  get termsInvalid(): boolean {
    const control = this.form.controls.terms;
    return control.invalid && (control.touched || control.dirty);
  }
}
