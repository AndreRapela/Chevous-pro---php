import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Service } from '../../../core/models';
import { ServiceIconComponent } from '../service-icon/service-icon.component';
import { serviceInitial } from '../../utils/service-name.util';

@Component({
  selector: 'cvp-service-card',
  standalone: true,
  imports: [RouterLink, ServiceIconComponent],
  templateUrl: './service-card.component.html',
  styleUrl: './service-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServiceCardComponent {
  @Input({ required: true }) service!: Service;
  initial(): string {
    return serviceInitial(this.service.name);
  }
}
