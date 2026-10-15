import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ProviderProfile } from '../../../../core/models';
import {
  AvatarComponent,
  RatingComponent,
  StatePanelComponent
} from '../../../../shared/components';
import { LocalizedMoneyPipe } from '../../../../shared/localization/localized-format.pipe';
import { BookingForm } from '../../models/booking-form.model';

@Component({
  selector: 'cvp-booking-provider-step',
  standalone: true,
  imports: [
    AvatarComponent,
    LocalizedMoneyPipe,
    RatingComponent,
    ReactiveFormsModule,
    StatePanelComponent
  ],
  templateUrl: './booking-provider-step.component.html',
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingProviderStepComponent {
  readonly marketplaceValue = '__marketplace__';
  @Input({ required: true }) form!: BookingForm;
  @Input() providers: ProviderProfile[] = [];
  @Output() readonly quoteRequested = new EventEmitter<void>();

  get invalid(): boolean {
    const control = this.form.controls.providerId;
    return control.invalid && (control.touched || control.dirty);
  }
}
