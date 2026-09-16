import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Service } from '../../../core/models';
import { LocalizedMoneyPipe } from '../../localization/localized-format.pipe';

@Component({
  selector: 'cvp-service-card',
  standalone: true,
  imports: [LocalizedMoneyPipe, RouterLink],
  template: `
    <article class="service-card">
      <span class="service-symbol" aria-hidden="true">{{ service.symbol }}</span>
      <div class="service-card-copy">
        <div class="eyebrow">{{ service.popular ? 'Mais pedido' : 'Serviço' }}</div>
        <h3><a [routerLink]="['/servicos', service.slug]">{{ service.name }}</a></h3>
        <p>{{ service.description }}</p>
        <div class="card-footer">
          <span>A partir de <strong>{{ service.priceFromCents / 100 | appMoney:'BRL':0 }}</strong></span>
          <a class="text-link" [routerLink]="['/servicos', service.slug]" [attr.aria-label]="'Ver detalhes de ' + service.name">Ver detalhes <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServiceCardComponent {
  @Input({ required: true }) service!: Service;
}
