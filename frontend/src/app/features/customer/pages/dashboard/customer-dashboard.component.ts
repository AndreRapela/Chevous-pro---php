import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Booking, DashboardMetric } from '../../../../core/models';
import {
  DateLineComponent,
  MetricGridComponent,
  PageHeaderComponent,
  StatePanelComponent,
  StatusPillComponent
} from '../../../../shared/components';
import {
  LocalizedDatePipe,
  LocalizedMoneyPipe
} from '../../../../shared/localization/localized-format.pipe';

@Component({
  selector: 'cvp-customer-dashboard',
  standalone: true,
  imports: [
    LocalizedDatePipe,
    LocalizedMoneyPipe,
    DateLineComponent,
    MetricGridComponent,
    PageHeaderComponent,
    RouterLink,
    StatePanelComponent,
    StatusPillComponent
  ],
  templateUrl: './customer-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerDashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly marketplace = inject(MarketplaceService);
  readonly bookings = signal<Booking[]>([]);
  readonly metrics = computed<DashboardMetric[]>(() =>
    this.marketplace.customerMetrics(this.bookings())
  );
  readonly loading = signal(true);
  readonly error = signal('');
  readonly nextBooking = computed(
    () =>
      this.bookings()
        .filter(
          (item) =>
            ['confirmed', 'awaiting_confirmation'].includes(item.status) &&
            Date.parse(item.scheduledAt) >= Date.now()
        )
        .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))[0]
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.marketplace.bookings().subscribe({
      next: (bookings) => {
        this.bookings.set(bookings);
        this.loading.set(false);
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.loading.set(false);
      }
    });
  }
}
