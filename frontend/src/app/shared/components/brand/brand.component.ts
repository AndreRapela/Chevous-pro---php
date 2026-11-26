import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'cvp-brand',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a class="brand" routerLink="/" aria-label="ChezVoust Pro, home">
      <span class="brand-logo" aria-hidden="true"></span>
    </a>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrandComponent {}
