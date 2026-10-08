import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Service } from '../../../core/models';
import { ServiceIconComponent } from '../service-icon/service-icon.component';
import { serviceInitial } from '../../utils/service-name.util';

@Component({
  selector: 'cvp-service-card',
  standalone: true,
  imports: [RouterLink, ServiceIconComponent],
  template: `
    <article class="service-tile">
      <span class="service-tile-illustration" [class.service-tile-initial]="service.isCustom" aria-hidden="true">
        @if (service.isCustom) { <span>{{ initial() }}</span> }
        @else { <cvp-service-icon [category]="service.categoryId" [serviceSlug]="service.slug" variant="illustration" /> }
      </span>
      <div class="service-tile-copy">
        <h3 class="service-tile-title"><a [routerLink]="['/servicos', service.slug]">{{ service.name }}</a></h3>
        <p class="service-tile-description">{{ service.description || 'Consulte o escopo e combine os detalhes com o profissional.' }}</p>
        <a class="service-tile-action" [routerLink]="['/servicos', service.slug]" [attr.aria-label]="'Ver detalhes de ' + service.name">Ver detalhes <span aria-hidden="true">→</span></a>
      </div>
    </article>
  `,
  styleUrl: './service-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServiceCardComponent {
  @Input({ required: true }) service!: Service;
  initial(): string { return serviceInitial(this.service.name); }
}
