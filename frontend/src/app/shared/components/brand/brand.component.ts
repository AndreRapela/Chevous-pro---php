import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'cvp-brand',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a class="brand" routerLink="/" aria-label="ChezVoust Pro, página inicial">
      <span class="brand-mark" aria-hidden="true"><span></span></span>
      <span>ChezVoust <strong>Pro</strong></span>
    </a>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrandComponent {}
