import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'cvp-booking-progress',
  standalone: true,
  template: `<div class="booking-progress" role="progressbar" aria-label="Progresso da reserva" aria-valuemin="1" [attr.aria-valuemax]="totalSteps" [attr.aria-valuenow]="step + 1"><div><span [style.width.%]="progress"></span></div><p>Etapa {{ step + 1 }} de {{ totalSteps }} <strong>{{ label }}</strong></p></div>`,
  styles: `:host { display: block; } @media (max-width: 47.99rem) { .booking-progress p { margin-bottom: 1rem; } }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingProgressComponent {
  @Input() step = 0;
  @Input() progress = 25;
  @Input() totalSteps = 4;
  @Input() label = '';
}
