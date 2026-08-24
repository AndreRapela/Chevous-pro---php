import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'cvp-state-panel',
  standalone: true,
  template: `
    <section class="state-panel" [attr.aria-live]="kind === 'loading' ? 'polite' : 'assertive'">
      @if (kind === 'loading') {
        <span class="spinner" aria-hidden="true"></span>
        <h2>Carregando</h2>
        <p>{{ message || 'Só um instante enquanto organizamos tudo.' }}</p>
      } @else {
        <span class="state-symbol" aria-hidden="true">{{ kind === 'error' ? '!' : '·' }}</span>
        <h2>{{ title }}</h2>
        <p>{{ message }}</p>
        @if (kind === 'error') {
          <button class="btn btn-secondary" type="button" (click)="retry.emit()">Tentar novamente</button>
        }
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatePanelComponent {
  @Input() kind: 'loading' | 'empty' | 'error' = 'loading';
  @Input() title = 'Nada por aqui ainda';
  @Input() message = '';
  @Output() readonly retry = new EventEmitter<void>();
}
