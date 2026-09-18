import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type ServiceIconName = 'cleaning' | 'laundry' | 'repairs' | 'painting' | 'assembly' | 'gardening' | 'organization' | 'moving' | 'care' | 'technology';

@Component({
  selector: 'cvp-service-icon',
  standalone: true,
  template: `
    <svg class="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      @switch (iconName()) {
        @case ('cleaning') { <path d="M7 9h10l-1 10H8L7 9Z" /><path d="M9 9V7.5a3 3 0 0 1 6 0V9" /><path d="M10 13h4" /><path d="M18 4v3M16.5 5.5h3" /> }
        @case ('laundry') { <rect x="4" y="3" width="16" height="18" rx="2.4" /><path d="M7.4 7.2h.01M10.3 7.2h.01" /><circle cx="12" cy="14.2" r="4.1" /><path d="M12 11.2a3 3 0 0 1 0 6" /> }
        @case ('repairs') { <path d="M14.7 5.6a4 4 0 0 1 4.1-1l-2.3 2.3.4 2.3 2.3.4 2.3-2.3a4 4 0 0 1-5.1 5L8 20.7a2.2 2.2 0 1 1-3.1-3.1l8.4-8.4a4 4 0 0 1 1.4-3.6Z" /> }
        @case ('painting') { <path d="M4 5.2h10.2v5.6H4z" /><path d="M14.2 8h2.2a3 3 0 0 1 3 3v1.1" /><path d="M19.4 12.1v3.4" /><path d="M17.4 15.5h4v4h-4z" /> }
        @case ('assembly') { <rect x="5" y="3" width="14" height="15" rx="1.5" /><path d="M12 3v15M7 18v3M17 18v3M9.5 10v2M14.5 10v2" /> }
        @case ('gardening') { <path d="M12 20V10" /><path d="M12 14c-4.5 0-6-3.1-6-6 4.5 0 6 2.7 6 6Z" /><path d="M12 10c0-4.1 2.3-6 6-6 0 4.2-2.5 6-6 6Z" /> }
        @case ('organization') { <rect x="4" y="5" width="7" height="5" rx="1" /><rect x="13" y="5" width="7" height="5" rx="1" /><rect x="4" y="13" width="16" height="6" rx="1" /><path d="M8 7.5h.01M16 7.5h.01M12 16h.01" /> }
        @case ('moving') { <path d="M3 5h11v11H3V5ZM14 9h4l3 4v3h-7" /><path d="M14 13h7M8 16h8" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /> }
        @case ('care') { <path d="M12 20s-7-4.3-7-10a3.8 3.8 0 0 1 7-2.1A3.8 3.8 0 0 1 19 10c0 5.7-7 10-7 10Z" /><path d="M8.5 13.2h7" /> }
        @default { <path d="M4 9.5a8 8 0 0 1 16 0" /><path d="M6.5 12.5a5.5 5.5 0 0 1 11 0" /><path d="M9.5 15.5a2.5 2.5 0 0 1 5 0" /><path d="M12 19h.01" /> }
      }
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServiceIconComponent {
  @Input() category = '';
  @Input() serviceSlug = '';
  @Input() icon = '';

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
