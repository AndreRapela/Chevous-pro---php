import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type ServiceIconName = 'cleaning' | 'laundry' | 'repairs' | 'painting' | 'assembly' | 'gardening' | 'organization' | 'moving' | 'care' | 'technology';

@Component({
  selector: 'cvp-service-icon',
  standalone: true,
  template: `
    <svg class="service-icon" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      @switch (iconName()) {
        @case ('cleaning') {
          <ellipse cx="11.5" cy="20.1" rx="7.8" ry="1.35" fill="#ccebdd" />
          <path d="M5.7 11.2h7.8l-.8 7.8H6.5l-.8-7.8Z" fill="#fff" stroke="#087e66" stroke-width="1.25" />
          <path d="M7 11.2c.25-2.2 1.25-3.3 2.65-3.3s2.4 1.1 2.65 3.3" stroke="#087e66" stroke-width="1.15" />
          <path d="m16.5 4.1 1.15.35-3.7 11.6-1.15-.35Z" fill="#f2b632" />
          <path d="m12.9 14.8 4.15 1.3-.7 3.1-5.3-1.65 1.85-2.75Z" fill="#38b779" stroke="#087e66" stroke-width=".85" />
          <path d="M7.9 14.1h3.4" stroke="#63cfa0" stroke-width="1.05" />
        }
        @case ('laundry') {
          <ellipse cx="12" cy="20.1" rx="7.25" ry="1.35" fill="#ccebdd" />
          <path d="m8.15 5.1 2.15-1.35c.8.95 2.6.95 3.4 0l2.15 1.35 3.05 2.7-2.3 2.65-1.65-1.1v9.05h-5.9V9.35l-1.65 1.1L5.1 7.8l3.05-2.7Z" fill="#45c67e" stroke="#087e66" stroke-width="1.05" />
          <path d="M10.25 4.1c.3 1.9 3.2 1.9 3.5 0" stroke="#fff" stroke-width="1.1" />
          <path d="M10.45 14.9h3.1" stroke="#f2cf45" stroke-width="1.2" />
        }
        @case ('repairs') {
          <ellipse cx="12" cy="20.2" rx="7.4" ry="1.3" fill="#ccebdd" />
          <path d="M7.1 17.8 16.5 6.9" stroke="#f2b632" stroke-width="2.25" />
          <path d="m16 4.2 3.6 3.1-1.7 2-3.6-3.1 1.7-2Z" fill="#ffd65d" stroke="#b06b08" stroke-width=".8" />
          <path d="m5 6.1 2.7 2.7 2.2-.6.6-2.2-2.7-2.7A4 4 0 0 0 12.3 8l6.25 6.25a2.05 2.05 0 1 1-2.9 2.9L9.4 10.9A4 4 0 0 0 5 6.1Z" fill="#39b779" stroke="#087e66" stroke-width="1.05" />
          <circle cx="17.05" cy="15.65" r=".8" fill="#fff" />
        }
        @case ('painting') {
          <ellipse cx="12" cy="20.2" rx="7.5" ry="1.3" fill="#f4eac4" />
          <rect x="4.1" y="4.5" width="10.8" height="5.2" rx="1.25" fill="#42bd79" stroke="#087e66" stroke-width="1" />
          <path d="M14.9 7.1h2.2a2.2 2.2 0 0 1 2.2 2.2v1.15a2 2 0 0 1-2 2h-4.1" stroke="#087e66" stroke-width="1.25" />
          <path d="M13.2 11.3h2.15v7.2H13.2z" fill="#f2b632" stroke="#b06b08" stroke-width=".85" />
          <path d="M6.2 6.2h6.5" stroke="#8be1ae" stroke-width="1.1" />
        }
        @case ('assembly') {
          <ellipse cx="12" cy="20.2" rx="7.3" ry="1.25" fill="#e6ddf4" />
          <rect x="5.1" y="4.2" width="13.8" height="13.6" rx="1.8" fill="#9b83c7" stroke="#60488f" stroke-width="1" />
          <path d="M12 4.2v13.6M8.8 10.9h.01M15.2 10.9h.01" stroke="#fff" stroke-width="1.45" />
          <path d="M7.2 17.8v2M16.8 17.8v2" stroke="#60488f" stroke-width="1.3" />
        }
        @case ('gardening') {
          <ellipse cx="12" cy="20.2" rx="7.5" ry="1.35" fill="#d8edce" />
          <path d="M11.7 19.1V9.5" stroke="#4b7b35" stroke-width="1.45" />
          <path d="M11.7 13.8C7.8 13.8 5.6 11.6 5.4 8c4.15 0 6.3 2.2 6.3 5.8Z" fill="#56b848" stroke="#3c8733" stroke-width=".9" />
          <path d="M11.7 10.1c.1-3.85 2.45-5.9 6.5-5.9-.1 3.85-2.4 5.9-6.5 5.9Z" fill="#83cf55" stroke="#3c8733" stroke-width=".9" />
          <path d="M7.6 18.1h8.8l-.8 2.2H8.4l-.8-2.2Z" fill="#f2b632" stroke="#b06b08" stroke-width=".85" />
        }
        @case ('organization') {
          <ellipse cx="12" cy="20.2" rx="7.5" ry="1.3" fill="#f1dce6" />
          <rect x="4" y="5" width="7.2" height="5.2" rx="1.3" fill="#e68aae" stroke="#934461" stroke-width=".9" />
          <rect x="12.8" y="5" width="7.2" height="5.2" rx="1.3" fill="#f1bc53" stroke="#a96e0e" stroke-width=".9" />
          <rect x="4" y="12.3" width="16" height="6.2" rx="1.4" fill="#fff" stroke="#934461" stroke-width="1" />
          <path d="M9.7 15.4h4.6" stroke="#934461" stroke-width="1.15" />
        }
        @case ('moving') {
          <ellipse cx="12" cy="20.3" rx="8.2" ry="1.35" fill="#d4eaf0" />
          <path d="M3.2 6h10.5v10.2H3.2z" fill="#39b779" stroke="#087e66" stroke-width="1" />
          <path d="M13.7 9.2h3.65l3.45 3.75v3.25h-7.1V9.2Z" fill="#f2cf45" stroke="#b06b08" stroke-width="1" />
          <path d="M16.1 10.5h1l1.65 1.8H16.1v-1.8Z" fill="#fff" />
          <circle cx="6.4" cy="17.4" r="1.65" fill="#426b96" stroke="#fff" stroke-width=".7" /><circle cx="17.8" cy="17.4" r="1.65" fill="#426b96" stroke="#fff" stroke-width=".7" />
        }
        @case ('care') {
          <ellipse cx="12" cy="20.2" rx="7.35" ry="1.3" fill="#f2dbe5" />
          <path d="M12 3.8c2.35 1.7 4.75 2.1 6.7 2.25v5.45c0 4.2-2.55 6.8-6.7 8.7-4.15-1.9-6.7-4.5-6.7-8.7V6.05C7.25 5.9 9.65 5.5 12 3.8Z" fill="#e1789e" stroke="#944263" stroke-width="1" />
          <path d="M12 15.9s-3.55-2.1-3.55-4.75a2.05 2.05 0 0 1 3.55-1.4 2.05 2.05 0 0 1 3.55 1.4c0 2.65-3.55 4.75-3.55 4.75Z" fill="#fff" />
        }
        @default {
          <ellipse cx="12" cy="20.2" rx="7.5" ry="1.3" fill="#d8e7f4" />
          <path d="M4.4 9.7a9.8 9.8 0 0 1 15.2 0" stroke="#426b96" stroke-width="2" />
          <path d="M7.3 12.8a6 6 0 0 1 9.4 0" stroke="#43b98a" stroke-width="2" />
          <path d="M10.1 15.8a2.45 2.45 0 0 1 3.8 0" stroke="#f2b632" stroke-width="2" />
          <circle cx="12" cy="18.4" r="1.15" fill="#426b96" />
        }
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
