import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'cvp-booking-progress',
  standalone: true,
  template: `<div class="booking-progress" role="progressbar" aria-label="Progresso da reserva" aria-valuemin="1" aria-valuemax="5" [attr.aria-valuenow]="step + 1"><div><span [style.width.%]="progress"></span></div><p>Etapa {{ step + 1 }} de 5 <strong>{{ label }}</strong></p></div>`,
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingProgressComponent {
  @Input() step = 0;
  @Input() progress = 20;
  @Input() label = '';
}
