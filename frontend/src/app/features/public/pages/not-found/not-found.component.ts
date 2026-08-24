import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'cvp-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `<section class="not-found"><div><span class="not-found-code">404</span><h1>Essa página não está por aqui.</h1><p>Talvez o endereço tenha mudado ou o link esteja incompleto.</p><a class="btn btn-primary" routerLink="/">Voltar ao início</a></div></section>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotFoundComponent {}
