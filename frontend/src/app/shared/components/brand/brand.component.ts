import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'cvp-brand',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a class="brand" routerLink="/" aria-label="ChezVoust Pro, home">
      <img class="brand-logo" src="/pro-logo.svg?v=20260923-green" alt="" width="220" height="138">
    </a>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrandComponent {}
