import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BookingForm } from '../../models/booking-form.model';

@Component({
  selector: 'cvp-booking-schedule-step',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="wizard-step" [formGroup]="form" aria-labelledby="step-schedule-title">
      <span class="eyebrow">Escolha o melhor momento</span><h1 id="step-schedule-title" tabindex="-1">Qual dia e horário?</h1><p>Você poderá conversar com o profissional após a confirmação.</p>
      <div class="schedule-grid"><label>Data<input type="date" formControlName="date" [min]="minDate" (change)="dateChanged.emit()" [attr.aria-invalid]="invalid('date')">@if (invalid('date')) { <small class="field-error" role="alert">Escolha uma data.</small> }</label><fieldset><legend>Horário</legend>@if (loading) { <p class="muted" role="status">Consultando as agendas…</p> } @else if (availabilityError) { <p class="field-error" role="alert">{{ availabilityError }}</p> } @else if (!form.controls.date.value) { <p class="muted">Escolha uma data para consultar os horários.</p> } @else if (!times.length) { <p class="muted">Nenhum profissional possui horário livre nesta data.</p> } @else { <div class="time-grid">@for (time of times; track time) { <label class="time-option" [class.selected]="form.controls.time.value === time"><input type="radio" formControlName="time" [value]="time"><span>{{ time }}</span></label> }</div> }@if (invalid('time')) { <small class="field-error" role="alert">Escolha um horário disponível.</small> }</fieldset></div>
      <div class="notice-card"><span aria-hidden="true">!</span><div><strong>Confirmação rápida</strong><p>Os profissionais recomendados costumam responder em menos de 30 minutos.</p></div></div>
    </section>
  `,
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingScheduleStepComponent {
  @Input({ required: true }) form!: BookingForm;
  @Input() minDate = '';
  @Input() times: string[] = [];
  @Input() loading = false;
  @Input() availabilityError = '';
  @Output() readonly dateChanged = new EventEmitter<void>();

  invalid(name: 'date' | 'time'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }
}
