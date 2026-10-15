import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  inject,
  signal
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { LocalizationService } from '../../../../core/localization/localization.service';
import { BookingForm } from '../../models/booking-form.model';
import {
  BookingCalendarDay,
  bookingCalendarDays,
  parseBookingDate
} from '../../utils/booking-calendar.util';

@Component({
  selector: 'cvp-booking-schedule-step',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './booking-schedule-step.component.html',
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
    return Array.from({ length: 7 }, (_, index) =>
      new Intl.DateTimeFormat(this.localization.locale(), { weekday: 'short' })
        .format(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index))
        .replace(/[.,]$/u, '')
    );
  }

  monthLabel(): string {
    return new Intl.DateTimeFormat(this.localization.locale(), {
      month: 'long',
      year: 'numeric'
    }).format(this.visibleMonth());
  }

  selectedDateLabel(): string {
    const date = parseBookingDate(this.form.controls.date.value);
    return date
      ? new Intl.DateTimeFormat(this.localization.locale(), {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        }).format(date)
      : '';
  }

  accessibleDate(value: string): string {
    const date = parseBookingDate(value);
    return date
      ? new Intl.DateTimeFormat(this.localization.locale(), { dateStyle: 'full' }).format(date)
      : value;
  }

  previousMonthDisabled(): boolean {
    const minimum = parseBookingDate(this.minDate);
    const visible = this.visibleMonth();
    return (
      !!minimum &&
      visible.getFullYear() === minimum.getFullYear() &&
      visible.getMonth() === minimum.getMonth()
    );
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
