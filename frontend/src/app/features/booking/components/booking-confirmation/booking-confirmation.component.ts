import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Booking } from '../../../../core/models';

@Component({
  selector: 'cvp-booking-confirmation',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink],
  template: `
    <div class="confirmation-page"><div class="success-mark">✓</div><span class="eyebrow">Reserva {{ booking.code }}</span><h1 tabindex="-1">{{ paymentConfirmed ? 'Reserva confirmada!' : 'Reserva criada!' }}</h1><p>{{ paymentConfirmed ? 'O pagamento de demonstração foi aprovado e o profissional já pode acompanhar a reserva.' : 'A intenção de pagamento foi criada. Conclua o pagamento quando a opção estiver disponível no seu painel.' }}</p><section class="confirmation-card"><div><span>Serviço</span><strong>{{ booking.service.name }}</strong></div><div><span>Quando</span><strong>{{ booking.scheduledAt | date:'EEEE, d MMM, HH:mm':'':'pt-BR' }}</strong></div><div><span>Região</span><strong>{{ booking.addressLabel }}</strong></div><div><span>Total</span><strong>{{ booking.price.totalCents / 100 | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</strong></div></section><div class="confirmation-actions"><a class="btn btn-primary" routerLink="/conta/agendamentos">Acompanhar reserva</a><a class="btn btn-secondary" routerLink="/">Voltar ao início</a></div></div>
  `,
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingConfirmationComponent {
  @Input({ required: true }) booking!: Booking;
  @Input() paymentConfirmed = false;
}
