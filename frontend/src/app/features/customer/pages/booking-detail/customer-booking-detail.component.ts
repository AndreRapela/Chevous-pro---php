import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Booking, BookingOffer } from '../../../../core/models';
import { PageHeaderComponent, StatePanelComponent, StatusPillComponent } from '../../../../shared/components';

@Component({
  selector: 'cvp-customer-booking-detail',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, PageHeaderComponent, RouterLink, StatePanelComponent, StatusPillComponent],
  template: `
    <section class="portal-page customer-booking-detail-page">
      <cvp-page-header eyebrow="Detalhes da reserva" [title]="booking()?.service?.name || 'Agendamento'" description="Consulte os dados confirmados desta reserva."><a class="btn btn-secondary" routerLink="/conta/agendamentos">Voltar</a></cvp-page-header>
      @if (loading()) { <cvp-state-panel kind="loading" /> }
      @else if (error()) { <cvp-state-panel kind="error" title="Reserva indisponível" [message]="error()" (retry)="load()" /> }
      @else if (booking(); as item) {
        @if (success()) { <div class="alert alert-success" role="status">{{ success() }}</div> }
        @if (actionError()) { <div class="alert alert-error" role="alert">{{ actionError() }}</div> }
        <div class="dashboard-grid"><section class="portal-card span-two"><div class="booking-card-top"><div><span class="eyebrow">{{ item.code }}</span><h2>{{ item.service.name }}</h2></div><cvp-status-pill [status]="item.status" /></div><dl class="booking-info-grid"><div><dt>Data e horário</dt><dd>{{ item.scheduledAt | date:'EEEE, dd/MM/yyyy · HH:mm':'':'pt-BR' }}</dd></div><div><dt>Profissional</dt><dd>{{ item.provider.name }}</dd></div><div><dt>Endereço</dt><dd>{{ item.addressLabel }}</dd></div><div><dt>Total</dt><dd>{{ item.price.totalCents / 100 | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</dd></div></dl>@if (item.notes) { <h3>Observações</h3><p>{{ item.notes }}</p> }</section><aside class="portal-card"><h2>Ações</h2><div class="card-actions">@if (item.allowedActions.includes('pay')) { <button class="btn btn-primary btn-block" type="button" [disabled]="acting()" (click)="pay()">{{ acting() ? 'Processando…' : 'Confirmar pagamento simulado' }}</button> }@if (item.canMessage && item.conversationId) { <a class="btn btn-primary btn-block" routerLink="/conta/mensagens" [queryParams]="{ conversa: item.conversationId }">Abrir conversa</a> }<a class="btn btn-secondary btn-block" routerLink="/conta/agendamentos">Gerenciar reserva</a></div></aside></div>
        @if (item.allowedActions.includes('offers')) { <section class="portal-card booking-offers"><div class="card-title-row"><div><span class="eyebrow">Marketplace</span><h2>Propostas recebidas</h2></div></div>@if (offersLoading()) { <p class="muted" role="status">Carregando propostas…</p> } @else if (!offers().length) { <p class="muted">Ainda não há propostas. Avisaremos quando um profissional responder.</p> } @else { <div class="request-list">@for (offer of offers(); track offer.id) { <article class="request-card"><div class="request-card-head"><div><strong>{{ offer.professionalName }}</strong><p>{{ offer.rating | number:'1.1-2':'pt-BR' }} · {{ offer.reviewsCount }} avaliações</p></div><strong>{{ offer.amountCents / 100 | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong></div><p>{{ offer.message || 'Proposta sem mensagem adicional.' }}</p><small class="muted">Válida até {{ offer.expiresAt | date:'dd/MM HH:mm':'':'pt-BR' }}</small>@if (pendingOffer()?.id === offer.id) { <div class="inline-confirm"><p>Confirmar esta proposta? As demais serão recusadas e a reserva seguirá para pagamento.</p><div class="card-actions"><button class="btn btn-secondary btn-small" type="button" (click)="pendingOffer.set(null)">Voltar</button><button class="btn btn-primary btn-small" type="button" [disabled]="acting()" (click)="acceptOffer(offer)">Confirmar proposta</button></div></div> } @else { <div class="card-actions"><button class="btn btn-primary btn-small" type="button" (click)="pendingOffer.set(offer)">Escolher proposta</button></div> }</article> }</div> }</section> }
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerBookingDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly marketplace = inject(MarketplaceService);
  readonly booking = signal<Booking | null>(null);
  readonly offers = signal<BookingOffer[]>([]);
  readonly pendingOffer = signal<BookingOffer | null>(null);
  readonly loading = signal(true);
  readonly offersLoading = signal(false);
  readonly acting = signal(false);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly success = signal('');

  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set('');
    this.marketplace.booking(this.route.snapshot.paramMap.get('id') ?? '').subscribe({
      next: (booking) => { this.booking.set(booking); this.loading.set(false); if (booking.allowedActions.includes('offers')) this.loadOffers(booking.id); },
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
      next: (updated) => { this.booking.set(updated); this.offers.set([]); this.pendingOffer.set(null); this.success.set('Proposta aceita. Confirme o pagamento dentro do prazo indicado.'); this.acting.set(false); },
      error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); }
    });
  }

  pay(): void {
    const booking = this.booking(); if (!booking || this.acting()) return;
    this.acting.set(true); this.actionError.set('');
    this.marketplace.payBooking(booking.id).subscribe({
      next: (updated) => { this.booking.set(updated); this.success.set(updated.status === 'confirmed' ? 'Pagamento simulado aprovado e reserva confirmada.' : 'Intenção de pagamento criada.'); this.acting.set(false); },
      error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); }
    });
  }
}
