import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { LocalizedNumberPipe } from '../../localization/localized-format.pipe';

@Component({
  selector: 'cvp-rating',
  standalone: true,
  imports: [LocalizedNumberPipe],
  template: `
    <span class="rating" [attr.aria-label]="rating + ' de 5, ' + count + ' avaliações'">
      <span aria-hidden="true">★</span> {{ rating | appNumber:2:2 }}
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
