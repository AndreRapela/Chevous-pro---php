import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Service } from '../../../core/models';
import { LocalizedMoneyPipe } from '../../localization/localized-format.pipe';
import { ServiceIconComponent } from '../service-icon/service-icon.component';
import { serviceInitial } from '../../utils/service-name.util';

@Component({
  selector: 'cvp-service-card',
  standalone: true,
  imports: [LocalizedMoneyPipe, RouterLink, ServiceIconComponent],
  template: `
    <article class="service-card">
      <span class="service-symbol" [class.service-symbol-initial]="service.isCustom" aria-hidden="true">
        @if (service.isCustom) { <span>{{ initial() }}</span> }
        @else { <cvp-service-icon [category]="service.categoryId" [serviceSlug]="service.slug" /> }
      </span>
      <div class="service-card-copy">
        @if (service.popular) { <div class="eyebrow">Mais pedido</div> }
        <h3><a [routerLink]="['/servicos', service.slug]">{{ service.name }}</a></h3>
        <p>{{ service.description || 'Consulte o escopo e combine os detalhes com o profissional.' }}</p>
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
  initial(): string { return serviceInitial(this.service.name); }
}
