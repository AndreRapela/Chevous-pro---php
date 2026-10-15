import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'cvp-state-panel',
  standalone: true,
  templateUrl: './state-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatePanelComponent {
  @Input() kind: 'loading' | 'empty' | 'error' = 'loading';
  @Input() title = 'Nada por aqui ainda';
  @Input() message = '';
  @Output() readonly retry = new EventEmitter<void>();
}
