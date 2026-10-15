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
import { Booking } from '../../../../core/models';
import {
  PageHeaderComponent,
  StatePanelComponent,
  StatusPillComponent
} from '../../../../shared/components';
import {
  LocalizedDatePipe,
  LocalizedMoneyPipe
} from '../../../../shared/localization/localized-format.pipe';

@Component({
  selector: 'cvp-customer-bookings',
  standalone: true,
  imports: [
    LocalizedDatePipe,
    LocalizedMoneyPipe,
    PageHeaderComponent,
    RouterLink,
    StatePanelComponent,
    StatusPillComponent
  ],
  templateUrl: './customer-bookings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerBookingsComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  readonly bookings = signal<Booking[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly filter = signal<'upcoming' | 'completed' | 'all'>('upcoming');
  readonly cancelTarget = signal('');
  readonly reviewTarget = signal('');
  readonly acting = signal(false);
  readonly actionError = signal('');
  readonly actionMessage = signal('');
  readonly tabs = [
    { value: 'upcoming' as const, label: 'Próximos' },
    { value: 'completed' as const, label: 'Concluídos' },
    { value: 'all' as const, label: 'Todos' }
  ];
  readonly filtered = computed(() =>
    this.bookings().filter(
      (booking) =>
        this.filter() === 'all' ||
        (this.filter() === 'completed'
          ? booking.status === 'completed'
          : !['completed', 'cancelled'].includes(booking.status))
    )
  );

  ngOnInit(): void {
    this.load();
  }

  selectTab(value: 'upcoming' | 'completed' | 'all'): void {
    this.filter.set(value);
  }
  tabKeydown(event: KeyboardEvent, value: 'upcoming' | 'completed' | 'all'): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = this.tabs.findIndex((tab) => tab.value === value);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? this.tabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + this.tabs.length) % this.tabs.length;
    this.filter.set(this.tabs[next]!.value);
    document.getElementById(`booking-tab-${this.tabs[next]!.value}`)?.focus();
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

  cancel(event: Event, booking: Booking): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const reason = form.querySelector('textarea')?.value.trim() || '';
    if (!reason) return;
    this.acting.set(true);
    this.actionError.set('');
    this.marketplace.cancelBooking(booking.id, reason).subscribe({
      next: (updated) => {
        this.bookings.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item))
        );
        this.cancelTarget.set('');
        this.actionMessage.set('Agendamento cancelado.');
        this.acting.set(false);
      },
      error: (failure: Error) => {
        this.actionError.set(failure.message);
        this.acting.set(false);
      }
    });
  }

  review(event: Event, booking: Booking): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const rating = Number((form.querySelector('select') as HTMLSelectElement | null)?.value || 5);
    const comment = form.querySelector('textarea')?.value.trim() || '';
    if (!comment) return;
    this.acting.set(true);
    this.actionError.set('');
    this.marketplace.reviewBooking(booking.id, rating, comment).subscribe({
      next: () => {
        this.bookings.update((items) =>
          items.map((item) => (item.id === booking.id ? { ...item, canReview: false } : item))
        );
        this.reviewTarget.set('');
        this.actionMessage.set('Avaliação enviada. Obrigado!');
        this.acting.set(false);
      },
      error: (failure: Error) => {
        this.actionError.set(failure.message);
        this.acting.set(false);
      }
    });
  }
}
