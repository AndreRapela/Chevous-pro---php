import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ProviderProfile, Service } from '../../../../core/models';
import { BookingForm } from '../../models/booking-form.model';
import { LocalizedDatePipe } from '../../../../shared/localization/localized-format.pipe';

@Component({
  selector: 'cvp-booking-review-step',
  standalone: true,
  imports: [LocalizedDatePipe, ReactiveFormsModule],
  template: `
    <section class="wizard-step" [formGroup]="form" aria-labelledby="step-confirm-title">
      <span class="eyebrow">Última etapa</span><h1 id="step-confirm-title" tabindex="-1">Revise e confirme</h1><p>O valor abaixo é uma referência calculada pela plataforma para os detalhes selecionados.</p>
      <section class="review-summary"><h2>Detalhes da reserva</h2><dl><div><dt>Serviço</dt><dd>{{ service.name }}</dd></div><div><dt>Data e horário</dt><dd>{{ scheduledDate | appDate:'EEEE, d MMM' }}, {{ form.controls.time.value }}</dd></div><div><dt>Profissional</dt><dd>{{ provider?.name || 'Receber propostas' }}</dd></div><div><dt>Endereço</dt><dd>{{ form.controls.address.controls.street.value }}, {{ form.controls.address.controls.number.value }} · {{ form.controls.address.controls.neighborhood.value }}</dd></div></dl></section>
      @if (provider) { <div class="privacy-note"><span aria-hidden="true">◇</span><div><strong>Reserva confirmada</strong><p>Ao confirmar, o horário ficará reservado e você poderá alinhar os detalhes diretamente com o profissional pelo chat.</p></div></div> } @else { <div class="privacy-note"><span aria-hidden="true">+</span><div><strong>Solicitação aberta</strong><p>Você receberá propostas, poderá comparar valores de referência e escolher o profissional que melhor atende à sua necessidade.</p></div></div> }
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

  get scheduledDate(): string {
    return this.form.controls.date.value ? `${this.form.controls.date.value}T12:00:00` : '';
  }

  get termsInvalid(): boolean {
    const control = this.form.controls.terms;
    return control.invalid && (control.touched || control.dirty);
  }
}
