import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Booking, BookingOffer, BookingStatus } from '../../../../core/models';
import {
  PageHeaderComponent,
  StatePanelComponent,
  StatusPillComponent
} from '../../../../shared/components';
import {
  LocalizedDatePipe,
  LocalizedMoneyPipe,
  LocalizedNumberPipe
} from '../../../../shared/localization/localized-format.pipe';

@Component({
  selector: 'cvp-customer-booking-detail',
  standalone: true,
  imports: [
    LocalizedDatePipe,
    LocalizedMoneyPipe,
    LocalizedNumberPipe,
    PageHeaderComponent,
    ReactiveFormsModule,
    RouterLink,
    StatePanelComponent,
    StatusPillComponent
  ],
  templateUrl: './customer-booking-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerBookingDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly marketplace = inject(MarketplaceService);
  private readonly fb = inject(FormBuilder);
  readonly booking = signal<Booking | null>(null);
  readonly offers = signal<BookingOffer[]>([]);
  readonly pendingOffer = signal<BookingOffer | null>(null);
  readonly loading = signal(true);
  readonly offersLoading = signal(false);
  readonly acting = signal(false);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly success = signal('');
  readonly rescheduleForm = this.fb.nonNullable.group({
    date: ['', Validators.required],
    time: ['', Validators.required]
  });

  ngOnInit(): void {
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.marketplace.booking(this.route.snapshot.paramMap.get('id') ?? '').subscribe({
      next: (booking) => {
        this.booking.set(booking);
        this.fillSchedule(booking);
        this.loading.set(false);
        if (booking.allowedActions.includes('offers')) this.loadOffers(booking.id);
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.loading.set(false);
      }
    });
  }

  loadOffers(bookingId: string): void {
    this.offersLoading.set(true);
    this.marketplace.bookingOffers(bookingId).subscribe({
      next: (offers) => {
        this.offers.set(offers.filter((offer) => offer.status === 'pending'));
        this.offersLoading.set(false);
      },
      error: (failure: Error) => {
        this.actionError.set(failure.message);
        this.offersLoading.set(false);
      }
    });
  }

  acceptOffer(offer: BookingOffer): void {
    const booking = this.booking();
    if (!booking || this.acting()) return;
    this.acting.set(true);
    this.actionError.set('');
    this.marketplace.acceptBookingOffer(booking.id, offer.id).subscribe({
      next: (updated) => {
        this.booking.set(updated);
        this.offers.set([]);
        this.pendingOffer.set(null);
        this.success.set('Proposta aceita e horário reservado.');
        this.acting.set(false);
      },
      error: (failure: Error) => {
        this.actionError.set(failure.message);
        this.acting.set(false);
      }
    });
  }

  reschedule(): void {
    this.rescheduleForm.markAllAsTouched();
    const booking = this.booking();
    const value = this.rescheduleForm.getRawValue();
    if (!booking || this.rescheduleForm.invalid || this.acting()) return;
    this.acting.set(true);
    this.actionError.set('');
    this.success.set('');
    this.marketplace.rescheduleBooking(booking.id, value.date, value.time).subscribe({
      next: (updated) => {
        this.booking.set(updated);
        this.fillSchedule(updated);
        this.success.set('Reserva reagendada. O profissional foi avisado.');
        this.acting.set(false);
      },
      error: (failure: Error) => {
        this.actionError.set(failure.message);
        this.acting.set(false);
      }
    });
  }

  minimumDate(): string {
    const date = new Date(Date.now() + 86400000);
    return this.localDate(date);
  }

  progressSteps(
    booking: Booking
  ): { status: BookingStatus; label: string; done: boolean; current: boolean; date?: string }[] {
    const sequence: { status: BookingStatus; label: string }[] = [
      { status: 'confirmed', label: 'Horário confirmado' },
      { status: 'provider_on_the_way', label: 'Profissional a caminho' },
      { status: 'in_progress', label: 'Serviço em andamento' },
      { status: 'completed', label: 'Serviço concluído' }
    ];
    const currentIndex = sequence.findIndex((step) => step.status === booking.status);
    return sequence.map((step, index) => ({
      ...step,
      done: currentIndex >= index && !['cancelled', 'disputed'].includes(booking.status),
      current: step.status === booking.status,
      date: booking.history?.filter((entry) => entry.toStatus === step.status).at(-1)?.createdAt
    }));
  }

  private fillSchedule(booking: Booking): void {
    const date = new Date(booking.scheduledAt);
    if (Number.isNaN(date.getTime())) return;
    this.rescheduleForm.setValue({
      date: this.localDate(date),
      time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    });
  }

  private localDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
