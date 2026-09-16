import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, Subject, catchError, combineLatest, distinctUntilChanged, forkJoin, map, of, switchMap } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { LocalizationService } from '../../../../core/localization/localization.service';
import { Address, Booking, BookingDraft, BookingQuote, ProviderProfile, Service } from '../../../../core/models';
import { StatePanelComponent } from '../../../../shared/components';
import { BookingAddressStepComponent } from '../../components/booking-address-step/booking-address-step.component';
import { BookingConfirmationComponent } from '../../components/booking-confirmation/booking-confirmation.component';
import { BookingDetailsStepComponent } from '../../components/booking-details-step/booking-details-step.component';
import { BookingPriceSummaryComponent } from '../../components/booking-price-summary/booking-price-summary.component';
import { BookingProgressComponent } from '../../components/booking-progress/booking-progress.component';
import { BookingProviderStepComponent } from '../../components/booking-provider-step/booking-provider-step.component';
import { BookingReviewStepComponent } from '../../components/booking-review-step/booking-review-step.component';
import { BookingScheduleStepComponent } from '../../components/booking-schedule-step/booking-schedule-step.component';
import { BookingDraftStorageService } from '../../data-access/booking-draft-storage.service';
import { createBookingForm } from '../../models/booking-form.model';
import { mergeAvailableSlots, providerIdsForSlot } from '../../utils/availability.util';

interface QuoteRequest {
  draft: BookingDraft;
}

@Component({
  selector: 'cvp-booking-wizard',
  standalone: true,
  imports: [
    BookingAddressStepComponent,
    BookingConfirmationComponent,
    BookingDetailsStepComponent,
    BookingPriceSummaryComponent,
    BookingProgressComponent,
    BookingProviderStepComponent,
    BookingReviewStepComponent,
    BookingScheduleStepComponent,
    RouterLink,
    StatePanelComponent
  ],
  template: `
    <section class="booking-page">
      <div class="container booking-topbar"><a class="back-link" [routerLink]="step() ? null : '/servicos'" (click)="step() ? previous() : null"><span aria-hidden="true">←</span> {{ step() ? 'Voltar' : 'Serviços' }}</a><span>Reserva segura</span></div>
      @if (loading()) {
        <div class="container narrow section"><cvp-state-panel kind="loading" message="Preparando seu agendamento." /></div>
      } @else if (loadError()) {
        <div class="container narrow section"><cvp-state-panel kind="error" title="Não foi possível iniciar a reserva" [message]="loadError()" (retry)="load()" /></div>
      } @else if (service(); as selectedService) {
        @if (step() < 5) {
          <div class="container booking-layout">
            <cvp-booking-price-summary [service]="selectedService" [homeSize]="form.controls.homeSize.value" [quote]="quote()" [loading]="quoteLoading()" [marketplace]="isMarketplace()" />
            <div class="booking-main">
              <cvp-booking-progress [step]="step()" [progress]="progress()" [label]="step() === 4 && isMarketplace() ? 'Revisão' : stepLabels[step()]" />
              <form (submit)="next(); $event.preventDefault()" novalidate>
                @if (submitError()) { <div class="alert alert-error" role="alert"><strong>Não foi possível continuar.</strong><span>{{ submitError() }}</span></div> }
                @switch (step()) {
                  @case (0) { <cvp-booking-details-step [form]="form" [service]="selectedService" (quoteRequested)="refreshQuote()" /> }
                  @case (1) { <cvp-booking-address-step [form]="form" [addresses]="addresses()" /> }
                  @case (2) { <cvp-booking-schedule-step [form]="form" [minDate]="minDate" [times]="times()" [loading]="availabilityLoading()" [availabilityError]="availabilityError()" (dateChanged)="dateChanged()" /> }
                  @case (3) { <cvp-booking-provider-step [form]="form" [providers]="providers()" (quoteRequested)="refreshQuote()" /> }
                  @case (4) { <cvp-booking-review-step [form]="form" [service]="selectedService" [provider]="selectedProvider()" /> }
                }
                <div class="wizard-actions"><button class="btn btn-secondary" type="button" (click)="previous()" [disabled]="step() === 0">Voltar</button><button class="btn btn-primary" type="submit" [disabled]="submitting() || quoteLoading() || availabilityLoading()">{{ availabilityLoading() ? 'Consultando agendas…' : submitting() ? 'Confirmando...' : step() === 4 ? (isMarketplace() ? 'Publicar solicitação' : 'Confirmar reserva') : 'Continuar' }} <span aria-hidden="true">→</span></button></div>
              </form>
            </div>
          </div>
        } @else if (confirmedBooking(); as booking) {
          <cvp-booking-confirmation [booking]="booking" />
        }
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingWizardComponent implements OnInit {
  private readonly localization = inject(LocalizationService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly marketplace = inject(MarketplaceService);
  private readonly draftStorage = inject(BookingDraftStorageService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new BehaviorSubject(0);
  private readonly quoteRequests = new Subject<QuoteRequest>();
  private bookingKey = '';
  private availabilityKey = '';
  private availabilityRevision = 0;
  private readonly availabilityByProvider = new Map<string, string[]>();

  readonly stepLabels = ['Detalhes', 'Endereço', 'Agenda', 'Profissional', 'Revisão'];
  readonly times = signal<string[]>([]);
  readonly minDate = this.localDateToday();
  readonly form = createBookingForm(this.fb);
  readonly service = signal<Service | null>(null);
  readonly addresses = signal<Address[]>([]);
  readonly providers = signal<ProviderProfile[]>([]);
  readonly allProviders = signal<ProviderProfile[]>([]);
  readonly availabilityLoading = signal(false);
  readonly availabilityError = signal('');
  readonly step = signal(0);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly submitError = signal('');
  readonly submitting = signal(false);
  readonly quote = signal<BookingQuote | null>(null);
  readonly quoteLoading = signal(false);
  readonly confirmedBooking = signal<Booking | null>(null);
  readonly progress = computed(() => ((this.step() + 1) / 5) * 100);

  ngOnInit(): void {
    this.bindQuoteRequests();
    this.bindRoute();
  }

  load(): void {
    this.reload.next(this.reload.value + 1);
  }

  next(): void {
    this.submitError.set('');
    if (!this.validateStep()) return;
    if (this.step() === 2) {
      this.advanceToProviders();
      return;
    }
    if (this.step() < 4) {
      this.step.update((value) => value + 1);
      if (this.step() === 4) this.refreshQuote();
      this.persist();
      this.focusHeading();
      return;
    }
    this.submit();
  }

  previous(): void {
    if (this.step() <= 0) return;
    this.step.update((value) => value - 1);
    this.persist();
    this.focusHeading();
  }

  selectedProvider(): ProviderProfile | undefined {
    return this.providers().find((person) => person.id === this.form.controls.providerId.value);
  }

  isMarketplace(): boolean { return this.form.controls.providerId.value === '__marketplace__'; }

  refreshQuote(): void {
    this.requestQuote();
  }

  dateChanged(): void {
    this.form.controls.time.setValue('');
    this.form.controls.providerId.setValue('');
    this.availabilityKey = '';
    this.loadAvailability(false);
  }

  private bindRoute(): void {
    combineLatest([
      this.route.paramMap.pipe(map((params) => params.get('serviceId') ?? 'clean-home')),
      this.route.queryParamMap.pipe(map((params) => params.get('profissional') ?? '')),
      this.reload
    ]).pipe(
      map(([serviceId, preferredProviderId, revision]) => ({ serviceId, preferredProviderId, revision })),
      distinctUntilChanged((left, right) => left.serviceId === right.serviceId && left.preferredProviderId === right.preferredProviderId && left.revision === right.revision),
      switchMap(({ serviceId, preferredProviderId }) => {
        this.loading.set(true);
        this.loadError.set('');
        return this.marketplace.service(serviceId).pipe(
          switchMap((service) => forkJoin({
            service: of(service),
            providers: this.marketplace.providers({ service: service.id }),
            addresses: this.marketplace.addresses().pipe(catchError(() => of([] as Address[])))
          }).pipe(
            map((result) => ({ ...result, preferredProviderId }))
          )),
          catchError((failure: Error) => of({ service: null, providers: [] as ProviderProfile[], addresses: [] as Address[], preferredProviderId, failure }))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((result) => {
      if (!result.service) {
        this.loadError.set('failure' in result ? result.failure.message : 'Serviço indisponível.');
        this.loading.set(false);
        return;
      }
      this.resetForm();
      this.service.set(result.service);
      this.configureServiceControls(result.service);
      this.allProviders.set(result.providers);
      this.providers.set(result.providers);
      this.addresses.set(result.addresses);
      if (result.preferredProviderId && result.providers.some((person) => person.id === result.preferredProviderId)) {
        this.form.controls.providerId.setValue(result.preferredProviderId);
      }
      this.restoreDraft(result.service.id);
      const preferredAddress = result.addresses.find((address) => !!address.isDefault) ?? result.addresses[0];
      if (preferredAddress && !this.form.controls.address.controls.postalCode.value) this.applySavedAddress(preferredAddress);
      if (this.form.controls.date.value) this.loadAvailability(false);
      this.refreshQuote();
      this.loading.set(false);
    });
  }

  private bindQuoteRequests(): void {
    this.quoteRequests.pipe(
      switchMap((request) => this.marketplace.quote(request.draft).pipe(
        map((quote) => ({ request, quote, error: '' })),
        catchError((failure: Error) => of({ request, quote: null, error: failure.message || 'Não foi possível calcular o valor.' }))
      )),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ quote, error }) => {
      this.quoteLoading.set(false);
      if (quote) { this.quote.set(quote); return; }
      this.quote.set(null);
      this.submitError.set(error);
    });
  }

  private requestQuote(): void {
    if (!this.service()) return;
    this.quoteLoading.set(true);
    this.quoteRequests.next({ draft: this.buildDraft() });
  }

  private validateStep(): boolean {
    const groups = [
      [this.form.controls.homeSize, this.form.controls.quantity, this.form.controls.durationMinutes, this.form.controls.notes],
      Object.values(this.form.controls.address.controls),
      [this.form.controls.date, this.form.controls.time],
      [this.form.controls.providerId],
      [this.form.controls.terms]
    ];
    const controls = groups[this.step()] ?? [];
    controls.forEach((control) => control.markAsTouched());
    return controls.every((control) => control.valid);
  }

  private submit(): void {
    if (!this.service()) return;
    this.persist();
    this.submitting.set(true);
    this.marketplace.confirmBooking(this.buildDraft(), this.bookingKey).subscribe({
      next: (result) => {
        this.confirmedBooking.set(result.booking);
        this.step.set(5);
        this.submitting.set(false);
        this.draftStorage.clear();
        this.focusHeading();
      },
      error: (failure: Error) => { this.submitError.set(failure.message); this.submitting.set(false); }
    });
  }

  private advanceToProviders(): void {
    const key = this.currentAvailabilityKey();
    if (key !== this.availabilityKey) {
      this.loadAvailability(true);
      return;
    }
    this.applyAvailableProviders(true);
  }

  private loadAvailability(advance: boolean): void {
    const revision = ++this.availabilityRevision;
    const service = this.service();
    const date = this.form.controls.date.value;
    if (!service || !date) {
      this.times.set([]);
      this.availabilityLoading.set(false);
      return;
    }
    if (!this.allProviders().length) {
      this.times.set([]);
      this.providers.set([]);
      this.availabilityLoading.set(false);
      if (advance) this.openProviderStep();
      return;
    }
    this.availabilityLoading.set(true);
    this.availabilityError.set('');
    const requests = this.allProviders().map((provider) => this.marketplace.publicProviderAvailability(provider.id, {
      date,
      durationMinutes: this.form.controls.durationMinutes.value
    }).pipe(
      map((availability) => ({ providerId: provider.id, slots: availability.slots ?? [], failed: false })),
      catchError(() => of({ providerId: provider.id, slots: [] as string[], failed: true }))
    ));
    forkJoin(requests).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (results) => {
        if (revision !== this.availabilityRevision) return;
        if (results.every((result) => result.failed)) {
          this.availabilityError.set('Não foi possível consultar as agendas agora. Tente novamente.');
          this.availabilityLoading.set(false);
          return;
        }
        this.availabilityByProvider.clear();
        for (const result of results) this.availabilityByProvider.set(result.providerId, result.slots);
        const slots = mergeAvailableSlots(results);
        this.times.set(slots);
        this.availabilityKey = this.currentAvailabilityKey();
        if (this.form.controls.time.value && !slots.includes(this.form.controls.time.value)) this.form.controls.time.setValue('');
        this.availabilityLoading.set(false);
        if (advance) this.applyAvailableProviders(true);
      },
      error: (failure: Error) => {
        if (revision !== this.availabilityRevision) return;
        this.availabilityError.set(failure.message || 'Não foi possível consultar as agendas.');
        this.availabilityLoading.set(false);
      }
    });
  }

  private applyAvailableProviders(advance: boolean): void {
    const time = this.form.controls.time.value;
    const results = this.allProviders().map((provider) => ({ providerId: provider.id, slots: this.availabilityByProvider.get(provider.id) ?? [] }));
    const availableIds = providerIdsForSlot(results, time);
    const available = this.allProviders().filter((provider) => availableIds.has(provider.id));
    this.providers.set(available);
    if (this.form.controls.providerId.value !== '__marketplace__' && !available.some((provider) => provider.id === this.form.controls.providerId.value)) this.form.controls.providerId.setValue('');
    if (!advance) return;
    this.openProviderStep();
  }

  private openProviderStep(): void {
    this.step.set(3);
    this.persist();
    this.focusHeading();
  }

  private currentAvailabilityKey(): string {
    return `${this.form.controls.date.value}|${this.form.controls.durationMinutes.value}`;
  }

  private persist(): void {
    const service = this.service();
    if (service) this.draftStorage.save(service.id, this.step(), this.form.getRawValue());
  }

  private restoreDraft(serviceId: string): void {
    const stored = this.draftStorage.load(serviceId);
    if (!stored) return;
    this.form.patchValue(stored.value);
    this.step.set(Math.min(4, Math.max(0, stored.step)));
  }

  private resetForm(): void {
    this.form.reset({
      homeSize: 80,
      quantity: 1,
      durationMinutes: 120,
      addonIds: [],
      notes: '',
      address: { postalCode: '', street: '', number: '', complement: '', neighborhood: '', city: 'São Paulo', state: 'SP' },
      date: '',
      time: '',
      providerId: '',
      terms: false
    });
    this.step.set(0);
    this.quote.set(null);
    this.confirmedBooking.set(null);
    this.times.set([]);
    this.availabilityByProvider.clear();
    this.availabilityRevision++;
    this.availabilityKey = '';
    this.bookingKey = this.marketplace.newIdempotencyKey('booking');
  }

  private configureServiceControls(service: Service): void {
    const minimum = Math.max(1, service.minimumQuantity || 1);
    const maximum = Math.max(minimum, service.maximumQuantity || 10000);
    if (service.pricingType === 'area' || service.unit === 'm²') {
      this.form.controls.homeSize.setValidators([Validators.required, Validators.min(minimum), Validators.max(maximum)]);
      this.form.controls.homeSize.setValue(Math.min(maximum, Math.max(minimum, 80)));
      this.form.controls.quantity.setValidators([Validators.required, Validators.min(1), Validators.max(10000)]);
      this.form.controls.quantity.setValue(1);
    } else {
      this.form.controls.homeSize.setValidators([Validators.required, Validators.min(1), Validators.max(10000)]);
      this.form.controls.quantity.setValidators([Validators.required, Validators.min(minimum), Validators.max(maximum)]);
      this.form.controls.quantity.setValue(minimum);
    }
    this.form.controls.durationMinutes.setValue(Math.min(1440, Math.max(30, service.durationMinutes)));
    this.form.controls.homeSize.updateValueAndValidity();
    this.form.controls.quantity.updateValueAndValidity();
    this.form.controls.durationMinutes.updateValueAndValidity();
  }

  private applySavedAddress(address: Address): void {
    this.form.controls.address.patchValue({
      postalCode: address.postalCode,
      street: address.street,
      number: address.number,
      complement: address.complement ?? '',
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state
    });
  }

  private focusHeading(): void {
    setTimeout(() => this.document.querySelector<HTMLElement>('.wizard-step h1, .confirmation-page h1')?.focus(), 0);
  }

  private buildDraft(): BookingDraft {
    const service = this.service();
    const value = this.form.getRawValue();
    return {
      serviceId: service?.id ?? '',
      homeSize: value.homeSize,
      quantity: value.quantity,
      durationMinutes: value.durationMinutes,
      addonIds: value.addonIds,
      notes: value.notes,
      address: value.address,
      date: value.date,
      time: value.time,
      providerId: value.providerId === '__marketplace__' ? '' : value.providerId,
      currency: this.localization.currency()
    };
  }

  private localDateToday(): string {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
  }

}
