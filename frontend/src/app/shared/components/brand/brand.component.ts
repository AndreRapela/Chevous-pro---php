import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'cvp-brand',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a class="brand" routerLink="/" aria-label="Pro, home">
      <img class="brand-logo" src="/pro-logo.svg" alt="Pro">
    </a>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrandComponent {}
