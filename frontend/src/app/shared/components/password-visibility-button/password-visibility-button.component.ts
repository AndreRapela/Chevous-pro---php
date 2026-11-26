import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LocalizationService } from '../../../core/localization/localization.service';

@Component({
  selector: 'cvp-password-visibility-button',
  template: `
    <button type="button" [attr.aria-controls]="fieldId()" [attr.aria-label]="label()" (click)="toggled.emit()">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        @if (visible()) {
          <path d="M2.5 12c2.4-4.1 5.8-6.5 9.5-6.5s7.1 2.4 9.5 6.5c-2.4 4.1-5.8 6.5-9.5 6.5S4.9 16.1 2.5 12Z" />
          <circle cx="12" cy="12" r="2.7" />
        } @else {
          <path d="M5.1 8.4A16 16 0 0 0 2.5 12c2.4 4.1 5.8 6.5 9.5 6.5 1.4 0 2.8-.4 4.1-1.1M9 6c1-.3 2-.5 3-.5 3.7 0 7.1 2.4 9.5 6.5a16 16 0 0 1-2 2.9" />
          <path d="m3 3 18 18" />
        }
      </svg>
    </button>
  `,
  styles: `
    :host { position: absolute; top: 50%; inset-inline-end: .2rem; transform: translateY(-50%); }
    button {
      display: grid;
      place-items: center;
      width: 2.75rem;
      height: 2.75rem;
      padding: 0;
      border: 0;
      border-radius: .4rem;
      color: var(--brand-800);
      background: transparent;
    }
    button:hover { background: var(--brand-50); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PasswordVisibilityButtonComponent {
  private readonly localization = inject(LocalizationService);
  readonly fieldId = input.required<string>();
  readonly visible = input.required<boolean>();
  readonly confirmation = input(false);
  readonly toggled = output<void>();
  protected readonly label = computed(() => {
    const [show, hide] = this.confirmation()
      ? ['Mostrar confirmação de senha', 'Ocultar confirmação de senha']
      : ['Mostrar senha', 'Ocultar senha'];
    return this.localization.translate(this.visible() ? hide : show);
  });
}
