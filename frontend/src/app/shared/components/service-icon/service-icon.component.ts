import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type ServiceIconName = 'cleaning' | 'laundry' | 'repairs' | 'painting' | 'gardening' | 'moving' | 'care' | 'technology';

@Component({
  selector: 'cvp-service-icon',
  standalone: true,
  template: `
    <svg class="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      @switch (iconName()) {
        @case ('cleaning') { <path d="m14.5 4 .6 1.9L17 6.5l-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9Z" /><path d="m6.5 11 .9 2.6L10 14.5l-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z" /><path d="M14 14.5 18.5 19" /> }
        @case ('laundry') { <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M7 7h.01M10 7h.01" /><circle cx="12" cy="14" r="4" /> }
        @case ('repairs') { <path d="m14.8 6.2 3-3 .8 3.8-2.6 2.6-3.8-.8 2.6-2.6Z" /><path d="m13.2 9.2-8.5 8.5a2.1 2.1 0 1 0 3 3l8.5-8.5" /> }
        @case ('painting') { <path d="M4 5h10v6H4z" /><path d="M14 8h2.5a2.5 2.5 0 0 1 2.5 2.5V12" /><path d="M11 11v4.5a3.5 3.5 0 0 0 3.5 3.5H16" /><path d="M16 19h4" /> }
        @case ('gardening') { <path d="M12 20V10" /><path d="M12 14c-4.5 0-6-3.1-6-6 4.5 0 6 2.7 6 6Z" /><path d="M12 10c0-4.1 2.3-6 6-6 0 4.2-2.5 6-6 6Z" /> }
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

  iconName(): ServiceIconName {
    const value = `${this.category} ${this.serviceSlug}`.toLocaleLowerCase('pt-BR');
    if (/laundry|lavander|lavar|passar/.test(value)) return 'laundry';
    if (/painting|pint/.test(value)) return 'painting';
    if (/gardening|jardin|garden/.test(value)) return 'gardening';
    if (/moving|mudan/.test(value)) return 'moving';
    if (/care|cuidado|pet|idos/.test(value)) return 'care';
    if (/technology|tecnolog|wifi|wi-fi/.test(value)) return 'technology';
    if (/repairs|reparo|repair|montagem|eletric/.test(value)) return 'repairs';
    return 'cleaning';
  }
}
