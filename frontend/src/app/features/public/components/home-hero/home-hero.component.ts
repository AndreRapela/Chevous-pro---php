import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ServiceIconComponent } from '../../../../shared/components/service-icon/service-icon.component';

@Component({
  selector: 'cvp-home-hero',
  standalone: true,
  imports: [FormsModule, RouterLink, ServiceIconComponent],
  template: `
    <section class="hero-section">
      <div class="container desktop-home-hero">
        <div class="desktop-hero-top">
          <div class="desktop-hero-visual">
            <span class="desktop-hero-orb orb-mint" aria-hidden="true"></span><span class="desktop-hero-orb orb-coral" aria-hidden="true"></span><span class="desktop-hero-orb orb-amber" aria-hidden="true"></span><img src="/images/profissional-limpeza-hero-warm-480.jpg" srcset="/images/profissional-limpeza-hero-warm-480.jpg 480w, /images/profissional-limpeza-hero-warm-887.jpg 887w" sizes="40vw" alt="" width="887" height="1774">
            <span class="desktop-hero-tag">Profissionais disponíveis</span>
          </div>
          <div class="desktop-hero-copy"><span class="eyebrow">Cuidado profissional para sua casa</span><h1>A melhor solução para o seu lar.</h1><p>Compare profissionais, escolha o melhor horário e acompanhe tudo pela plataforma.</p><form class="hero-search desktop-hero-search" (ngSubmit)="submitSearch()" role="search"><label class="sr-only" for="home-search-desktop">Qual serviço você precisa?</label><span aria-hidden="true">⌕</span><input id="home-search-desktop" name="desktopQuery" [ngModel]="query" (ngModelChange)="updateQuery($event)" placeholder="Qual serviço você precisa?" autocomplete="off"><button class="btn btn-primary" type="submit">Buscar</button></form></div>
        </div>
        <div class="desktop-hero-lower">
            <article class="desktop-promo-card">
              <div><span class="eyebrow">Escolha com confiança</span><strong>Perfis avaliados e aprovados</strong><small>Compare experiência, avaliações e disponibilidade</small></div>
            </article>
            <nav class="desktop-service-strip" aria-label="Serviços em destaque">
              <span class="eyebrow">Serviços</span>
              <div class="desktop-service-links">
                <a routerLink="/servicos" [queryParams]="{ q: 'limpeza' }"><b aria-hidden="true"><cvp-service-icon category="cleaning" /></b>Limpeza</a>
                <a routerLink="/servicos" [queryParams]="{ q: 'lavagem' }"><b aria-hidden="true"><cvp-service-icon category="laundry" /></b>Lavagem</a>
                <a routerLink="/servicos" [queryParams]="{ q: 'reparo' }"><b aria-hidden="true"><cvp-service-icon category="repairs" /></b>Reparos</a>
                <a routerLink="/servicos" [queryParams]="{ q: 'pintura' }"><b aria-hidden="true"><cvp-service-icon category="painting" /></b>Pintura</a>
              </div>
            </nav>
            <article class="desktop-booking-preview" aria-label="Prévia de agendamento">
              <header><span class="avatar avatar-sm" aria-hidden="true" data-cvp-no-localize>AC</span><span><strong data-cvp-no-localize>Ana Clara</strong><small>Perfil aprovado</small></span><span class="verified" title="Perfil aprovado">✓</span></header>
              <dl><div><dt>Serviço</dt><dd>Limpeza residencial</dd></div><div><dt>Horário</dt><dd>Qui, 14h</dd></div></dl>
              <a class="btn btn-primary btn-block" routerLink="/servicos/limpeza-residencial">Agendar agora</a>
            </article>
        </div>
      </div>
      <div class="container hero-stack">
        <article class="hero-banner"><div class="hero-banner-photo"><img class="hero-banner-image" src="/images/profissional-limpeza-hero-warm-480.jpg" srcset="/images/profissional-limpeza-hero-warm-480.jpg 480w, /images/profissional-limpeza-hero-warm-887.jpg 887w" sizes="(max-width: 42rem) calc(100vw - 2rem), 50vw" alt="Profissional de limpeza sorrindo com luvas e frasco de limpeza" width="887" height="1774" fetchpriority="high"></div><div class="hero-banner-shade" aria-hidden="true"></div><div class="hero-banner-copy"><span class="hero-banner-label">Em destaque</span><span class="hero-banner-proof"><span aria-hidden="true">✓</span> Perfis aprovados</span><h1>Serviços para sua casa, sem complicação.</h1><p>Escolha, compare e agende em poucos minutos.</p><a class="btn hero-banner-cta" routerLink="/servicos">Explorar serviços <span aria-hidden="true">→</span></a></div></article>
        <div class="hero-quick-bar"><form class="hero-search" (ngSubmit)="submitSearch()" role="search"><label class="sr-only" for="home-search">Qual serviço você precisa?</label><span aria-hidden="true">⌕</span><input id="home-search" name="q" [ngModel]="query" (ngModelChange)="updateQuery($event)" placeholder="Qual serviço você precisa?" autocomplete="off"><button class="btn btn-primary" type="submit">Buscar</button></form><div class="hero-trust"><span><strong>✓</strong> Preço transparente</span><span><strong>✓</strong> Perfis aprovados</span><span><strong>✓</strong> Suporte na plataforma</span></div></div>
      </div>
    </section>
  `,
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeHeroComponent {
  @Input() query = '';
  @Output() readonly queryChange = new EventEmitter<string>();
  @Output() readonly searchRequested = new EventEmitter<void>();

  updateQuery(value: string): void {
    this.query = value;
    this.queryChange.emit(value);
  }

  submitSearch(): void {
    this.searchRequested.emit();
  }
}
