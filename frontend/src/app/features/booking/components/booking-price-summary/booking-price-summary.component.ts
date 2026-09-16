import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BookingQuote, Service } from '../../../../core/models';
import { LocalizedMoneyPipe } from '../../../../shared/localization/localized-format.pipe';

@Component({
  selector: 'cvp-booking-price-summary',
  standalone: true,
  imports: [LocalizedMoneyPipe],
  template: `
    <aside class="price-card" [attr.aria-label]="marketplace ? 'Resumo da estimativa' : 'Resumo do preço'" aria-live="polite">
      <span class="eyebrow">{{ marketplace ? 'Sua solicitação' : 'Seu agendamento' }}</span>
      <div class="price-service"><span class="service-symbol">{{ service.symbol }}</span><div><strong>{{ service.name }}</strong><small>{{ detailLabel }}</small></div></div>
      @if (quote; as currentQuote) {
        <dl><div><dt>Referência do serviço</dt><dd>{{ currentQuote.subtotalCents / 100 | appMoney:currentQuote.currency }}</dd></div><div class="price-total"><dt>Estimativa inicial</dt><dd>{{ currentQuote.totalCents / 100 | appMoney:currentQuote.currency }}</dd></div></dl>
        <small>Não há cobrança pela plataforma. Confirme os detalhes e o valor diretamente com o profissional.</small>
      } @else {
        <p>{{ loading ? 'Calculando valor…' : 'Selecione os detalhes para calcular.' }}</p>
      }
      <div class="secure-line"><span aria-hidden="true">{{ marketplace ? '+' : '◇' }}</span> {{ marketplace ? 'Compare propostas com tranquilidade' : 'Horário reservado ao confirmar' }}</div>
    </aside>
  `,
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingPriceSummaryComponent {
  @Input({ required: true }) service!: Service;
  @Input() homeSize = 0;
  @Input() quote: BookingQuote | null = null;
  @Input() loading = false;
  @Input() marketplace = false;

  get detailLabel(): string {
    if (this.quote?.pricingType === 'area' || this.service.pricingType === 'area') return `${this.quote?.areaSqm ?? this.homeSize} m²`;
    if (this.quote?.pricingType === 'hourly' || this.service.pricingType === 'hourly') return `${(this.quote?.durationMinutes ?? this.service.durationMinutes) / 60} hora(s)`;
    return `${this.quote?.quantity ?? 1} unidade(s)`;
  }
}
