import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type ServiceIconName =
  | 'cleaning'
  | 'laundry'
  | 'repairs'
  | 'painting'
  | 'assembly'
  | 'gardening'
  | 'organization'
  | 'moving'
  | 'care'
  | 'technology';

@Component({
  selector: 'cvp-service-icon',
  standalone: true,
  templateUrl: './service-icon.component.html',
  styles: `.service-icon.service-icon-illustration { width: 2.75rem; height: 2.75rem; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServiceIconComponent {
  @Input() category = '';
  @Input() serviceSlug = '';
  @Input() icon = '';
  @Input() variant: 'compact' | 'illustration' = 'compact';

  iconName(): ServiceIconName {
    const value = `${this.icon} ${this.category} ${this.serviceSlug}`.toLocaleLowerCase('pt-BR');
    if (/laundry|lavander|lavagem|lavar|passar/.test(value)) return 'laundry';
    if (/painting|pint/.test(value)) return 'painting';
    if (/gardening|jardin|garden/.test(value)) return 'gardening';
    if (/package|assembly|assemble|montagem|moveis|móveis/.test(value)) return 'assembly';
    if (/boxes|organiz|arruma|armario|armário/.test(value)) return 'organization';
    if (/moving|mudan/.test(value)) return 'moving';
    if (/care|cuidado|pet|idos/.test(value)) return 'care';
    if (/technology|tecnolog|wifi|wi-fi/.test(value)) return 'technology';
    if (/tools|repairs|reparo|repair|eletric/.test(value)) return 'repairs';
    return 'cleaning';
  }
}
