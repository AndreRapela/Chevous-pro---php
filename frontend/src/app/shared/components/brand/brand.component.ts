import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'cvp-brand',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a class="brand" routerLink="/" aria-label="ChezVoust Pro, home">
      <span class="brand-name" data-cvp-no-localize>ChezVoust</span>
      <img class="brand-logo" src="/pro-logo.svg?v=20260918" alt="Pro" width="128" height="64">
    </a>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrandComponent {}
