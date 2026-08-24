import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'cvp-rating',
  standalone: true,
  template: `
    <span class="rating" [attr.aria-label]="rating + ' de 5, ' + count + ' avaliações'">
      <span aria-hidden="true">★</span> {{ rating.toFixed(2).replace('.', ',') }}
      @if (showCount) { <span class="muted">({{ count }})</span> }
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RatingComponent {
  @Input() rating = 0;
  @Input() count = 0;
  @Input() showCount = true;
}
