import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'cvp-page-header',
  standalone: true,
  template: `
    <div class="portal-page-heading">
      <div>
        <span class="eyebrow">{{ eyebrow }}</span>
        <h1>{{ title }}</h1>
        @if (description) { <p>{{ description }}</p> }
      </div>
      <ng-content />
    </div>
  `,
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageHeaderComponent {
  @Input({ required: true }) eyebrow = '';
  @Input({ required: true }) title = '';
  @Input() description = '';
}
