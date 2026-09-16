import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Booking } from '../../../../core/models';
import { LocalizedDatePipe, LocalizedMoneyPipe } from '../../../../shared/localization/localized-format.pipe';

@Component({
  selector: 'cvp-booking-confirmation',
  standalone: true,
  imports: [LocalizedDatePipe, LocalizedMoneyPipe, RouterLink],
  template: `
    <div class="confirmation-page"><div class="success-mark">✓</div><span class="eyebrow">Reserva {{ booking.code }}</span><h1 tabindex="-1">{{ booking.status === 'open' ? 'Solicitação publicada!' : 'Reserva confirmada!' }}</h1><p>{{ booking.status === 'open' ? 'Profissionais compatíveis já podem enviar propostas. Compare as ofertas no painel antes de escolher.' : 'O horário foi reservado e o profissional já pode acompanhar os detalhes pelo chat.' }}</p><section class="confirmation-card"><div><span>Serviço</span><strong>{{ booking.service.name }}</strong></div><div><span>Quando</span><strong>{{ booking.scheduledAt | appDate:'EEEE, d MMM, HH:mm' }}</strong></div><div><span>Região</span><strong>{{ booking.addressLabel }}</strong></div><div><span>{{ booking.status === 'open' ? 'Estimativa' : 'Valor de referência' }}</span><strong>{{ booking.price.totalCents / 100 | appMoney:booking.price.currency }}</strong></div></section><div class="confirmation-actions"><a class="btn btn-primary" routerLink="/conta/agendamentos">{{ booking.status === 'open' ? 'Acompanhar propostas' : 'Acompanhar reserva' }}</a><a class="btn btn-secondary" routerLink="/">Voltar ao início</a></div></div>
  `,
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingConfirmationComponent {
  @Input({ required: true }) booking!: Booking;
}
