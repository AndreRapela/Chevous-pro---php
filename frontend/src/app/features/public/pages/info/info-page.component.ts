import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { INFO_PAGES } from '../../data/info-page-content';

@Component({
  selector: 'cvp-info-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page-hero info-page-hero"><div class="container narrow"><span class="eyebrow">{{ page.eyebrow }}</span><h1>{{ page.title }}</h1><p>{{ page.intro }}</p></div></section>
    <section class="section info-page-content"><div class="container narrow"><div class="info-grid">@for (section of page.sections; track section.title) { <article class="content-card"><span class="info-symbol" aria-hidden="true">{{ section.symbol }}</span><h2>{{ section.title }}</h2><p>{{ section.text }}</p></article> }</div><div class="help-cta"><h2>Quer acompanhar uma reserva?</h2><p>Entre na sua conta para consultar detalhes, cancelamentos, notificações e conversas disponíveis.</p><a class="btn btn-primary" routerLink="/entrar">Acessar minha conta</a></div></div></section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InfoPageComponent {
  private readonly route = inject(ActivatedRoute);
  readonly page = INFO_PAGES[String(this.route.snapshot.data['page'] ?? 'how')] ?? INFO_PAGES['how']!;
}
