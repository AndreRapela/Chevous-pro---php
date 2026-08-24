import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Service } from '../../../core/models';

@Component({
  selector: 'cvp-service-card',
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  template: `
    <article class="service-card">
      <span class="service-symbol" aria-hidden="true">{{ service.symbol }}</span>
      <div class="service-card-copy">
        <div class="eyebrow">{{ service.popular ? 'Mais pedido' : 'Serviço' }}</div>
        <h3>{{ service.name }}</h3>
        <p>{{ service.description }}</p>
        <div class="card-footer">
          <span>A partir de <strong>{{ service.priceFromCents / 100 | currency:'BRL':'symbol':'1.0-0':'pt-BR' }}</strong></span>
          <a class="text-link" [routerLink]="['/agendar', service.id]" [attr.aria-label]="'Agendar ' + service.name">Agendar <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServiceCardComponent {
  @Input({ required: true }) service!: Service;
}
