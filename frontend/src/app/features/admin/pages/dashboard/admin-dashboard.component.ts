import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { BookingStatus, DashboardMetric } from '../../../../core/models';
import {
  MetricGridComponent,
  PageHeaderComponent,
  StatePanelComponent,
  StatusPillComponent
} from '../../../../shared/components';
import { LocalizedDatePipe } from '../../../../shared/localization/localized-format.pipe';

@Component({
  selector: 'cvp-admin-dashboard',
  standalone: true,
  imports: [
    LocalizedDatePipe,
    MetricGridComponent,
    PageHeaderComponent,
    RouterLink,
    StatePanelComponent,
    StatusPillComponent
  ],
  templateUrl: './admin-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashboardComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  readonly dashboard = signal<Record<string, unknown>>({});
  readonly metrics = computed<DashboardMetric[]>(() =>
    this.marketplace.dashboardMetricsFor('admin', this.dashboard())
  );
  readonly recent = signal<Record<string, unknown>[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.marketplace.adminDashboard().subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
        this.recent.set(
          Array.isArray(dashboard['recentBookings'])
            ? (dashboard['recentBookings'] as Record<string, unknown>[])
            : []
        );
        this.loading.set(false);
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.loading.set(false);
      }
    });
  }

  value(item: Record<string, unknown>, key: string, fallback = '—'): string {
    const value = item[key];
    return typeof value === 'string' && value ? value : fallback;
  }

  utcDate(item: Record<string, unknown>, key: string): string {
    const value = this.value(item, key, '');
    return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
      ? `${value.replace(' ', 'T')}Z`
      : value;
  }

  bookingStatus(item: Record<string, unknown>): BookingStatus {
    const status = this.value(item, 'status', 'awaiting_confirmation') as BookingStatus;
    return [
      'open',
      'awaiting_confirmation',
      'confirmed',
      'provider_on_the_way',
      'in_progress',
      'completed',
      'cancelled',
      'disputed'
    ].includes(status)
      ? status
      : 'awaiting_confirmation';
  }
}
