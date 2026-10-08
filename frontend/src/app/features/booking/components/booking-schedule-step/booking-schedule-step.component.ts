import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { LocalizationService } from '../../../../core/localization/localization.service';
import { BookingForm } from '../../models/booking-form.model';
import { BookingCalendarDay, bookingCalendarDays, parseBookingDate } from '../../utils/booking-calendar.util';

@Component({
  selector: 'cvp-booking-schedule-step',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="wizard-step booking-schedule-step" [formGroup]="form" aria-labelledby="step-schedule-title">
      <header class="booking-section-heading">
        <div><span class="eyebrow">Data e horário</span><h2 id="step-schedule-title">Escolha o dia e o horário</h2><p>{{ providerSelected ? 'Selecione uma data para consultar a disponibilidade do profissional escolhido.' : 'Selecione uma data para consultar a disponibilidade dos profissionais.' }}</p></div>
        @if (form.controls.date.value) { <span class="booking-selected-date">{{ selectedDateLabel() }}</span> }
      </header>
      <div class="booking-calendar" aria-label="Calendário de agendamento">
        <div class="booking-calendar-header">
          <strong>{{ monthLabel() }}</strong>
          <div><button class="calendar-nav" type="button" aria-label="Mês anterior" [disabled]="previousMonthDisabled()" (click)="changeMonth(-1)">‹</button><button class="calendar-nav" type="button" aria-label="Próximo mês" (click)="changeMonth(1)">›</button></div>
        </div>
        <div class="booking-calendar-weekdays" aria-hidden="true">@for (weekday of weekdays(); track $index) { <span>{{ weekday }}</span> }</div>
        <div class="booking-calendar-days">
          @for (day of calendarCells(); track day.date) {
            @if (day.inCurrentMonth) {
              <button class="calendar-day" type="button" [disabled]="day.disabled" [class.selected]="form.controls.date.value === day.date" [attr.aria-label]="accessibleDate(day.date)" [attr.aria-pressed]="form.controls.date.value === day.date" (click)="selectDate(day)">{{ day.day }}</button>
            } @else { <span class="calendar-day-placeholder" aria-hidden="true"></span> }
          }
        </div>
      </div>
      @if (invalid('date')) { <small class="field-error" role="alert">Escolha uma data.</small> }
      <fieldset class="booking-times">
        <legend>Horários disponíveis</legend>
        @if (loading) { <p class="muted" role="status">Consultando as agendas…</p> }
        @else if (availabilityError) { <p class="field-error" role="alert">{{ availabilityError }}</p> }
        @else if (!form.controls.date.value) { <p class="muted">Escolha uma data para ver os horários.</p> }
        @else if (!hasProfessionals) { <div class="schedule-empty" role="status"><strong>Ainda não há profissionais para este serviço.</strong><p>Escolha outro serviço ou volte mais tarde.</p></div> }
        @else if (!times.length) { <div class="schedule-empty" role="status"><strong>Sem horários livres nesta data.</strong><p>As agendas variam por dia e horários já reservados não aparecem. Selecione outra data para consultar novamente.</p></div> }
        @else { <div class="time-grid">@for (time of times; track time) { <label class="time-option" [class.selected]="form.controls.time.value === time"><input type="radio" formControlName="time" [value]="time"><span>{{ time }}</span></label> }</div> }
        @if (invalid('time') && times.length) { <small class="field-error" role="alert">Escolha um horário disponível.</small> }
      </fieldset>
      <div class="notice-card"><span aria-hidden="true">!</span><div><strong>Confirmação rápida</strong><p>Os profissionais recomendados costumam responder em menos de 30 minutos.</p></div></div>
    </section>
  `,
  styleUrl: './booking-schedule-step.component.scss',
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingScheduleStepComponent implements OnChanges {
  private readonly localization = inject(LocalizationService);

  @Input({ required: true }) form!: BookingForm;
  @Input() minDate = '';
  @Input() times: string[] = [];
  @Input() loading = false;
  @Input() availabilityError = '';
  @Input() hasProfessionals = true;
  @Input() providerSelected = false;
  @Output() readonly dateChanged = new EventEmitter<void>();

  readonly visibleMonth = signal(new Date());

  ngOnChanges(): void {
    const selectedDate = this.form?.controls.date.value || this.minDate;
    const parsed = parseBookingDate(selectedDate);
    if (parsed) this.visibleMonth.set(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  }

  calendarCells(): BookingCalendarDay[] {
    const month = this.visibleMonth();
    return bookingCalendarDays(month.getFullYear(), month.getMonth(), this.minDate);
  }

  weekdays(): string[] {
    const monday = new Date(2024, 0, 1);
    return Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(this.localization.locale(), { weekday: 'short' })
      .format(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index)).replace(/[.,]$/u, ''));
  }

  monthLabel(): string {
    return new Intl.DateTimeFormat(this.localization.locale(), { month: 'long', year: 'numeric' }).format(this.visibleMonth());
  }

  selectedDateLabel(): string {
    const date = parseBookingDate(this.form.controls.date.value);
    return date ? new Intl.DateTimeFormat(this.localization.locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(date) : '';
  }

  accessibleDate(value: string): string {
    const date = parseBookingDate(value);
    return date ? new Intl.DateTimeFormat(this.localization.locale(), { dateStyle: 'full' }).format(date) : value;
  }

  previousMonthDisabled(): boolean {
    const minimum = parseBookingDate(this.minDate);
    const visible = this.visibleMonth();
    return !!minimum && visible.getFullYear() === minimum.getFullYear() && visible.getMonth() === minimum.getMonth();
  }

  changeMonth(delta: number): void {
    const current = this.visibleMonth();
    const next = new Date(current.getFullYear(), current.getMonth() + delta, 1);
    const minimum = parseBookingDate(this.minDate);
    if (minimum && next < new Date(minimum.getFullYear(), minimum.getMonth(), 1)) return;
    this.visibleMonth.set(next);
  }

  selectDate(day: BookingCalendarDay): void {
    if (day.disabled) return;
    this.form.controls.date.setValue(day.date);
    this.form.controls.date.markAsTouched();
    this.form.controls.date.markAsDirty();
    this.dateChanged.emit();
  }

  invalid(name: 'date' | 'time'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }
}
