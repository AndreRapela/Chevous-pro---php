import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ProviderProfile, Service } from '../../../../core/models';
import { BookingForm } from '../../models/booking-form.model';
import { homeSizeRange } from '../../utils/booking-home-size.util';
import { LocalizedDatePipe } from '../../../../shared/localization/localized-format.pipe';

@Component({
  selector: 'cvp-booking-review-step',
  standalone: true,
  imports: [LocalizedDatePipe, ReactiveFormsModule],
  templateUrl: './booking-review-step.component.html',
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingReviewStepComponent {
  @Input({ required: true }) form!: BookingForm;
  @Input({ required: true }) service!: Service;
  @Input() provider?: ProviderProfile;

  get hasHomeSize(): boolean {
    return !!homeSizeRange(this.service);
  }

  get scheduledDate(): string {
    return this.form.controls.date.value ? `${this.form.controls.date.value}T12:00:00` : '';
  }

  get termsInvalid(): boolean {
    const control = this.form.controls.terms;
    return control.invalid && (control.touched || control.dirty);
  }
}
