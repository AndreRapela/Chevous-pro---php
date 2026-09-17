import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type ServiceIconName = 'cleaning' | 'laundry' | 'repairs' | 'painting' | 'assembly' | 'gardening' | 'organization' | 'moving' | 'care' | 'technology';

@Component({
  selector: 'cvp-service-icon',
  standalone: true,
  template: `
    <svg class="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      @switch (iconName()) {
        @case ('cleaning') { <path d="m15.2 3 .8 2.5 2.5.8-2.5.8-.8 2.5-.8-2.5-2.5-.8 2.5-.8.8-2.5Z" /><path d="m7.2 10 1 3.1 3.1 1-3.1 1-1 3.1-1-3.1-3.1-1 3.1-1 1-3.1Z" /><path d="M14.2 15.2 19 20" /> }
        @case ('laundry') { <rect x="4" y="3" width="16" height="18" rx="2.4" /><path d="M7.4 7.2h.01M10.3 7.2h.01" /><circle cx="12" cy="14.2" r="4.1" /><path d="M12 11.2a3 3 0 0 1 0 6" /> }
        @case ('repairs') { <path d="M14.7 5.6a4 4 0 0 1 4.1-1l-2.3 2.3.4 2.3 2.3.4 2.3-2.3a4 4 0 0 1-5.1 5L8 20.7a2.2 2.2 0 1 1-3.1-3.1l8.4-8.4a4 4 0 0 1 1.4-3.6Z" /> }
        @case ('painting') { <path d="M4 5.2h10.2v5.6H4z" /><path d="M14.2 8h2.2a3 3 0 0 1 3 3v1.1" /><path d="M19.4 12.1v3.4" /><path d="M17.4 15.5h4v4h-4z" /> }
        @case ('assembly') { <path d="m4 8.1 8-4.1 8 4.1-8 4.1-8-4.1Z" /><path d="M4 8.1v8l8 4 8-4v-8" /><path d="M12 12.2v7.9" /><path d="M8.4 6 12 7.9 15.6 6" /> }
        @case ('gardening') { <path d="M12 20V10" /><path d="M12 14c-4.5 0-6-3.1-6-6 4.5 0 6 2.7 6 6Z" /><path d="M12 10c0-4.1 2.3-6 6-6 0 4.2-2.5 6-6 6Z" /> }
        @case ('organization') { <rect x="4" y="5" width="7" height="5" rx="1" /><rect x="13" y="5" width="7" height="5" rx="1" /><rect x="4" y="13" width="16" height="6" rx="1" /><path d="M8 7.5h.01M16 7.5h.01M12 16h.01" /> }
        @case ('moving') { <path d="m4 8 8-4 8 4-8 4-8-4Z" /><path d="M4 8v8l8 4 8-4V8" /><path d="M12 12v8" /> }
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
