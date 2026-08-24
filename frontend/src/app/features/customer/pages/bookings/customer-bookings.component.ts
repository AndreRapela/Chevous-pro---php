import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Booking } from '../../../../core/models';
import { PageHeaderComponent, StatePanelComponent, StatusPillComponent } from '../../../../shared/components';

@Component({
  selector: 'cvp-customer-bookings',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, PageHeaderComponent, RouterLink, StatePanelComponent, StatusPillComponent],
  template: `
    <section class="portal-page customer-bookings-page">
      <cvp-page-header eyebrow="Sua agenda" title="Agendamentos" description="Acompanhe serviços futuros e seu histórico."><a class="btn btn-primary" routerLink="/servicos">+ Agendar serviço</a></cvp-page-header>
      <div class="tabs" role="tablist" aria-label="Filtrar agendamentos">@for (tab of tabs; track tab.value) { <button type="button" role="tab" [id]="'booking-tab-' + tab.value" [attr.aria-controls]="'booking-panel-' + tab.value" [attr.tabindex]="filter() === tab.value ? 0 : -1" [attr.aria-selected]="filter() === tab.value" [class.active]="filter() === tab.value" (click)="selectTab(tab.value)" (keydown)="tabKeydown($event, tab.value)">{{ tab.label }}</button> }</div>
      @if (actionMessage()) { <div class="alert alert-success" role="status">{{ actionMessage() }}</div> }
      @if (actionError()) { <div class="alert alert-error" role="alert">{{ actionError() }}</div> }
      @if (loading()) {
        <cvp-state-panel kind="loading" />
      } @else if (error()) {
        <cvp-state-panel kind="error" title="Agendamentos indisponíveis" [message]="error()" (retry)="load()" />
      } @else if (!filtered().length) {
        <cvp-state-panel kind="empty" title="Nenhum agendamento aqui" message="Quando você fizer uma reserva, ela aparecerá nesta lista." />
      } @else {
        <div class="booking-list" role="tabpanel" [id]="'booking-panel-' + filter()" [attr.aria-labelledby]="'booking-tab-' + filter()">@for (booking of filtered(); track booking.id) {
          <article class="booking-list-card">
            <div class="booking-card-top"><div><span class="eyebrow">{{ booking.code }}</span><h2>{{ booking.service.name }}</h2></div><cvp-status-pill [status]="booking.status" /></div>
            <div class="booking-info-grid"><div><span>Data e horário</span><strong>{{ booking.scheduledAt | date:'EEE, dd MMM · HH:mm':'':'pt-BR' }}</strong></div><div><span>Profissional</span><strong>{{ booking.provider.name }}</strong></div><div><span>Região</span><strong>{{ booking.addressLabel }}</strong></div><div><span>Total</span><strong>{{ booking.price.totalCents / 100 | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong></div></div>
            <div class="card-actions"><a class="btn btn-secondary btn-small" [routerLink]="['/conta/agendamentos', booking.id]">Detalhes</a>@if (booking.canMessage && booking.conversationId) { <a class="btn btn-secondary btn-small" routerLink="/conta/mensagens" [queryParams]="{ conversa: booking.conversationId }">Enviar mensagem</a> }@if (booking.canCancel) { <button class="btn btn-danger btn-small" type="button" (click)="cancelTarget.set(cancelTarget() === booking.id ? '' : booking.id)">Cancelar</button> }@if (booking.canReview) { <button class="btn btn-primary btn-small" type="button" (click)="reviewTarget.set(reviewTarget() === booking.id ? '' : booking.id)">Avaliar serviço</button> }</div>
            @if (cancelTarget() === booking.id) { <form class="inline-action-form" (submit)="cancel($event, booking)"><label>Motivo do cancelamento<textarea required maxlength="500" placeholder="Conte brevemente o motivo"></textarea></label><button class="btn btn-danger btn-small" type="submit" [disabled]="acting()">Confirmar cancelamento</button></form> }
            @if (reviewTarget() === booking.id) { <form class="inline-action-form" (submit)="review($event, booking)"><label>Nota<select required><option value="5">5 — Excelente</option><option value="4">4 — Muito bom</option><option value="3">3 — Bom</option><option value="2">2 — Regular</option><option value="1">1 — Ruim</option></select></label><label>Comentário<textarea required maxlength="1000" placeholder="Como foi o serviço?"></textarea></label><button class="btn btn-primary btn-small" type="submit" [disabled]="acting()">Enviar avaliação</button></form> }
          </article>
        }</div>
      }
    </section>
  `,
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
  readonly tabs = [{ value: 'upcoming' as const, label: 'Próximos' }, { value: 'completed' as const, label: 'Concluídos' }, { value: 'all' as const, label: 'Todos' }];
  readonly filtered = computed(() => this.bookings().filter((booking) => this.filter() === 'all' || (this.filter() === 'completed' ? booking.status === 'completed' : !['completed', 'cancelled'].includes(booking.status))));

  ngOnInit(): void { this.load(); }

  selectTab(value: 'upcoming' | 'completed' | 'all'): void { this.filter.set(value); }
  tabKeydown(event: KeyboardEvent, value: 'upcoming' | 'completed' | 'all'): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = this.tabs.findIndex((tab) => tab.value === value);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? this.tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + this.tabs.length) % this.tabs.length;
    this.filter.set(this.tabs[next]!.value);
    document.getElementById(`booking-tab-${this.tabs[next]!.value}`)?.focus();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.marketplace.bookings().subscribe({
      next: (bookings) => { this.bookings.set(bookings); this.loading.set(false); },
      error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); }
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
        this.bookings.update((items) => items.map((item) => item.id === updated.id ? updated : item));
        this.cancelTarget.set('');
        this.actionMessage.set('Agendamento cancelado.');
        this.acting.set(false);
      },
      error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); }
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
        this.bookings.update((items) => items.map((item) => item.id === booking.id ? { ...item, canReview: false } : item));
        this.reviewTarget.set('');
        this.actionMessage.set('Avaliação enviada. Obrigado!');
        this.acting.set(false);
      },
      error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); }
    });
  }
}
