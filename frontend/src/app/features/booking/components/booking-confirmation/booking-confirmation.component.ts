import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Booking } from '../../../../core/models';
import {
  LocalizedDatePipe,
  LocalizedMoneyPipe
} from '../../../../shared/localization/localized-format.pipe';

@Component({
  selector: 'cvp-booking-confirmation',
  standalone: true,
  imports: [LocalizedDatePipe, LocalizedMoneyPipe, RouterLink],
  templateUrl: './booking-confirmation.component.html',
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingConfirmationComponent {
  @Input({ required: true }) booking!: Booking;
}
