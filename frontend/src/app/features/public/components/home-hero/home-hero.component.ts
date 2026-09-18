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
          <div class="desktop-hero-visual" aria-hidden="true"><span class="desktop-hero-orb orb-mint"></span><span class="desktop-hero-orb orb-coral"></span><span class="desktop-hero-orb orb-amber"></span><img src="/images/profissional-limpeza-hero-warm-480.jpg" srcset="/images/profissional-limpeza-hero-warm-480.jpg 480w, /images/profissional-limpeza-hero-warm-887.jpg 887w" sizes="40vw" alt="" width="887" height="1774"></div>
          <div class="desktop-hero-copy"><span class="eyebrow">Cuidado profissional para sua casa</span><h2>A melhor solução para o seu lar.</h2><p>Compare profissionais, escolha o melhor horário e acompanhe tudo pela plataforma.</p><form class="hero-search desktop-hero-search" (ngSubmit)="submitSearch()" role="search"><label class="sr-only" for="home-search-desktop">Qual serviço você precisa?</label><span aria-hidden="true">⌕</span><input id="home-search-desktop" name="desktopQuery" [ngModel]="query" (ngModelChange)="updateQuery($event)" placeholder="Qual serviço você precisa?" autocomplete="off"><button class="btn btn-primary" type="submit">Buscar</button></form></div>
        </div>
        <nav class="desktop-service-strip" aria-label="Serviços em destaque">
          <a routerLink="/servicos" [queryParams]="{ q: 'limpeza' }"><b aria-hidden="true"><cvp-service-icon category="cleaning" /></b>Limpeza</a>
          <a routerLink="/servicos" [queryParams]="{ q: 'lavagem' }"><b aria-hidden="true"><cvp-service-icon category="laundry" /></b>Lavagem</a>
          <a routerLink="/servicos" [queryParams]="{ q: 'reparo' }"><b aria-hidden="true"><cvp-service-icon category="repairs" /></b>Reparos</a>
          <a routerLink="/servicos" [queryParams]="{ q: 'pintura' }"><b aria-hidden="true"><cvp-service-icon category="painting" /></b>Pintura</a>
        </nav>
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
