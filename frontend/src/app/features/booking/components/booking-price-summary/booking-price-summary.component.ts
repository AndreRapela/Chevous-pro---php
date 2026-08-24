import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BookingQuote, Service } from '../../../../core/models';

@Component({
  selector: 'cvp-booking-price-summary',
  standalone: true,
  imports: [CurrencyPipe],
  template: `
    <aside class="price-card" aria-label="Resumo do preço" aria-live="polite">
      <span class="eyebrow">Seu agendamento</span>
      <div class="price-service"><span class="service-symbol">{{ service.symbol }}</span><div><strong>{{ service.name }}</strong><small>{{ detailLabel }}</small></div></div>
      @if (quote; as currentQuote) {
        <dl><div><dt>Serviço</dt><dd>{{ currentQuote.subtotalCents / 100 | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</dd></div><div><dt>Taxa de serviço</dt><dd>{{ currentQuote.serviceFeeCents / 100 | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</dd></div>@if (currentQuote.discountCents) { <div class="discount-line"><dt>Desconto</dt><dd>− {{ currentQuote.discountCents / 100 | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</dd></div> }<div class="price-total"><dt>Total</dt><dd>{{ currentQuote.totalCents / 100 | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</dd></div></dl>
        <small>Valor calculado pela plataforma para os detalhes atuais.</small>
      } @else {
        <p>{{ loading ? 'Calculando valor…' : 'Selecione os detalhes para calcular.' }}</p>
      }
      <div class="secure-line"><span aria-hidden="true">◇</span> Pagamento protegido</div>
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

  get detailLabel(): string {
    if (this.quote?.pricingType === 'area' || this.service.pricingType === 'area') return `${this.quote?.areaSqm ?? this.homeSize} m²`;
    if (this.quote?.pricingType === 'hourly' || this.service.pricingType === 'hourly') return `${(this.quote?.durationMinutes ?? this.service.durationMinutes) / 60} hora(s)`;
    return `${this.quote?.quantity ?? 1} unidade(s)`;
  }
}
