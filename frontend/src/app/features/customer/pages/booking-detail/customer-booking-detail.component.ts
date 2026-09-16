import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Booking, BookingOffer, BookingStatus } from '../../../../core/models';
import { PageHeaderComponent, StatePanelComponent, StatusPillComponent } from '../../../../shared/components';
import { LocalizedDatePipe, LocalizedMoneyPipe, LocalizedNumberPipe } from '../../../../shared/localization/localized-format.pipe';

@Component({
  selector: 'cvp-customer-booking-detail',
  standalone: true,
  imports: [LocalizedDatePipe, LocalizedMoneyPipe, LocalizedNumberPipe, PageHeaderComponent, ReactiveFormsModule, RouterLink, StatePanelComponent, StatusPillComponent],
  template: `
    <section class="portal-page customer-booking-detail-page">
      <cvp-page-header eyebrow="Detalhes da reserva" [title]="booking()?.service?.name || 'Agendamento'" description="Acompanhe cada etapa e gerencie sua reserva."><a class="btn btn-secondary" routerLink="/conta/agendamentos">Voltar</a></cvp-page-header>
      @if (loading()) { <cvp-state-panel kind="loading" /> }
      @else if (error()) { <cvp-state-panel kind="error" title="Reserva indisponível" [message]="error()" (retry)="load()" /> }
      @else if (booking(); as item) {
        @if (success()) { <div class="alert alert-success" role="status">{{ success() }}</div> }
        @if (actionError()) { <div class="alert alert-error" role="alert">{{ actionError() }}</div> }
        @if (item.status === 'provider_on_the_way') { <div class="arrival-banner" role="status"><span class="arrival-icon">→</span><div><strong>{{ item.provider.name }} está a caminho</strong><p>Acompanhe atualizações por esta página ou fale com o profissional pela conversa.</p></div></div> }
        <div class="dashboard-grid">
          <section class="portal-card span-two">
            <div class="booking-card-top"><div><span class="eyebrow">{{ item.code }}</span><h2>{{ item.service.name }}</h2></div><cvp-status-pill [status]="item.status" /></div>
            <dl class="booking-info-grid"><div><dt>Data e horário</dt><dd>{{ item.scheduledAt | appDate:'EEEE, MMM d, yyyy · HH:mm' }}</dd></div><div><dt>Profissional</dt><dd>{{ item.provider.name }}</dd></div><div><dt>Endereço</dt><dd>{{ item.addressLabel }}</dd></div><div><dt>Total</dt><dd>{{ item.price.totalCents / 100 | appMoney:item.price.currency }}</dd></div></dl>
            @if (item.notes) { <h3>Instruções para o atendimento</h3><p>{{ item.notes }}</p> }
          </section>
          <aside class="portal-card">
            <h2>Ações</h2><div class="card-actions vertical-actions">
              @if (item.canMessage && item.conversationId) { <a class="btn btn-primary btn-block" routerLink="/conta/mensagens" [queryParams]="{ conversa: item.conversationId }">Falar com o profissional</a> }
              <a class="btn btn-secondary btn-block" [routerLink]="['/agendar', item.service.id]" [queryParams]="item.provider.id ? { profissional: item.provider.id } : {}">Agendar novamente</a>
            </div>
          </aside>
        </div>
        <div class="booking-detail-lower-grid">
          <section class="portal-card booking-progress"><span class="eyebrow">Acompanhamento</span><h2>Andamento da reserva</h2>
            <ol>@for (step of progressSteps(item); track step.status) { <li [class.done]="step.done" [class.current]="step.current"><span></span><div><strong>{{ step.label }}</strong>@if (step.date) { <small>{{ step.date | appDate:'MMM d, yyyy HH:mm' }}</small> }</div></li> }</ol>
          </section>
          @if (item.allowedActions.includes('reschedule')) {
            <form class="portal-card reschedule-card" [formGroup]="rescheduleForm" (ngSubmit)="reschedule()" novalidate><span class="eyebrow">Flexibilidade</span><h2>Reagendar</h2><p class="muted">Escolha um novo horário disponível para o mesmo profissional.</p><label>Nova data<input type="date" formControlName="date" [min]="minimumDate()"></label><label>Novo horário<input type="time" formControlName="time" step="1800"></label><button class="btn btn-secondary btn-block" type="submit" [disabled]="acting()">{{ acting() ? 'Salvando…' : 'Confirmar novo horário' }}</button></form>
          }
        </div>
        @if (item.allowedActions.includes('offers')) { <section class="portal-card booking-offers"><div class="card-title-row"><div><span class="eyebrow">Marketplace</span><h2>Propostas recebidas</h2></div></div>@if (offersLoading()) { <p class="muted" role="status">Carregando propostas…</p> } @else if (!offers().length) { <p class="muted">Ainda não há propostas. Avisaremos quando um profissional responder.</p> } @else { <div class="request-list">@for (offer of offers(); track offer.id) { <article class="request-card"><div class="request-card-head"><div><strong>{{ offer.professionalName }}</strong><p>{{ offer.rating | appNumber:1:2 }} · {{ offer.reviewsCount }} avaliações</p></div><strong>{{ offer.amountCents / 100 | appMoney:item.price.currency }}</strong></div><p>{{ offer.message || 'Proposta sem mensagem adicional.' }}</p><small class="muted">Válida até {{ offer.expiresAt | appDate:'MMM d, HH:mm' }}</small>@if (pendingOffer()?.id === offer.id) { <div class="inline-confirm"><p>Confirmar esta proposta? As demais serão recusadas e o horário será reservado com o profissional.</p><div class="card-actions"><button class="btn btn-secondary btn-small" type="button" (click)="pendingOffer.set(null)">Voltar</button><button class="btn btn-primary btn-small" type="button" [disabled]="acting()" (click)="acceptOffer(offer)">Confirmar proposta</button></div></div> } @else { <div class="card-actions"><button class="btn btn-primary btn-small" type="button" (click)="pendingOffer.set(offer)">Escolher proposta</button></div> }</article> }</div> }</section> }
      }
    </section>
  `,
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
  readonly rescheduleForm = this.fb.nonNullable.group({ date: ['', Validators.required], time: ['', Validators.required] });

  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set('');
    this.marketplace.booking(this.route.snapshot.paramMap.get('id') ?? '').subscribe({
      next: (booking) => { this.booking.set(booking); this.fillSchedule(booking); this.loading.set(false); if (booking.allowedActions.includes('offers')) this.loadOffers(booking.id); },
      error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); }
    });
  }

  loadOffers(bookingId: string): void {
    this.offersLoading.set(true);
    this.marketplace.bookingOffers(bookingId).subscribe({
      next: (offers) => { this.offers.set(offers.filter((offer) => offer.status === 'pending')); this.offersLoading.set(false); },
      error: (failure: Error) => { this.actionError.set(failure.message); this.offersLoading.set(false); }
    });
  }

  acceptOffer(offer: BookingOffer): void {
    const booking = this.booking(); if (!booking || this.acting()) return;
    this.acting.set(true); this.actionError.set('');
    this.marketplace.acceptBookingOffer(booking.id, offer.id).subscribe({
      next: (updated) => { this.booking.set(updated); this.offers.set([]); this.pendingOffer.set(null); this.success.set('Proposta aceita e horário reservado.'); this.acting.set(false); },
      error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); }
    });
  }

  reschedule(): void {
    this.rescheduleForm.markAllAsTouched();
    const booking = this.booking(); const value = this.rescheduleForm.getRawValue();
    if (!booking || this.rescheduleForm.invalid || this.acting()) return;
    this.acting.set(true); this.actionError.set(''); this.success.set('');
    this.marketplace.rescheduleBooking(booking.id, value.date, value.time).subscribe({
      next: (updated) => { this.booking.set(updated); this.fillSchedule(updated); this.success.set('Reserva reagendada. O profissional foi avisado.'); this.acting.set(false); },
      error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); }
    });
  }

  minimumDate(): string { const date = new Date(Date.now() + 86400000); return this.localDate(date); }

  progressSteps(booking: Booking): { status: BookingStatus; label: string; done: boolean; current: boolean; date?: string }[] {
    const sequence: { status: BookingStatus; label: string }[] = [
      { status: 'confirmed', label: 'Horário confirmado' },
      { status: 'provider_on_the_way', label: 'Profissional a caminho' }, { status: 'in_progress', label: 'Serviço em andamento' }, { status: 'completed', label: 'Serviço concluído' }
    ];
    const currentIndex = sequence.findIndex((step) => step.status === booking.status);
    return sequence.map((step, index) => ({ ...step, done: currentIndex >= index && !['cancelled', 'disputed'].includes(booking.status), current: step.status === booking.status, date: booking.history?.filter((entry) => entry.toStatus === step.status).at(-1)?.createdAt }));
  }

  private fillSchedule(booking: Booking): void {
    const date = new Date(booking.scheduledAt);
    if (Number.isNaN(date.getTime())) return;
    this.rescheduleForm.setValue({ date: this.localDate(date), time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` });
  }

  private localDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
