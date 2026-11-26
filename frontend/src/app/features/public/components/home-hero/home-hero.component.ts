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
            <span class="desktop-hero-orb orb-mint" aria-hidden="true"></span><span class="desktop-hero-orb orb-coral" aria-hidden="true"></span><span class="desktop-hero-orb orb-amber" aria-hidden="true"></span>
            <!-- Keep both portraits' responsive attributes identical so the browser fetches one file. -->
            <img src="/images/profissional-limpeza-hero-480.webp"
              srcset="/images/profissional-limpeza-hero-480.webp 480w, /images/profissional-limpeza-hero-887.webp 887w"
              sizes="(min-width: 64rem) 14.3rem, (min-width: 48rem) clamp(15rem, 30vw, 18rem), clamp(13.8rem, 63vw, 16.5rem)"
              alt="" width="887" height="1774" fetchpriority="high">
            <span class="desktop-hero-tag">Profissionais disponíveis</span>
          </div>
          <div class="desktop-hero-copy"><span class="eyebrow">Cuidado profissional para sua casa</span><h1>A melhor solução para o seu lar.</h1><p>Compare profissionais, escolha o melhor horário e acompanhe tudo pela plataforma.</p><form class="hero-search desktop-hero-search" (ngSubmit)="submitSearch()" role="search"><label class="sr-only" for="home-search-desktop">Qual serviço você precisa?</label><span aria-hidden="true">⌕</span><input id="home-search-desktop" name="desktopQuery" [ngModel]="query" (ngModelChange)="updateQuery($event)" placeholder="Qual serviço você precisa?" autocomplete="off"><button class="btn btn-primary" type="submit">Buscar</button></form></div>
        </div>
        <nav class="desktop-service-strip" aria-label="Serviços em destaque">
          <span class="eyebrow">Serviços</span>
          <div class="desktop-service-links">
            <a routerLink="/servicos" [queryParams]="{ q: 'limpeza' }"><b aria-hidden="true"><cvp-service-icon category="cleaning" /></b>Limpeza</a>
            <a routerLink="/servicos" [queryParams]="{ q: 'lavagem' }"><b aria-hidden="true"><cvp-service-icon category="laundry" /></b>Lavagem</a>
            <a routerLink="/servicos" [queryParams]="{ q: 'reparo' }"><b aria-hidden="true"><cvp-service-icon category="repairs" /></b>Reparos</a>
            <a routerLink="/servicos" [queryParams]="{ q: 'pintura' }"><b aria-hidden="true"><cvp-service-icon category="painting" /></b>Pintura</a>
            <a routerLink="/servicos" [queryParams]="{ q: 'jardim' }"><b aria-hidden="true"><cvp-service-icon category="gardening" /></b>Jardim</a>
          </div>
        </nav>
      </div>
      <div class="container hero-stack">
        <article class="hero-banner">
          <span class="mobile-hero-orb mobile-hero-orb-mint" aria-hidden="true"></span>
          <span class="mobile-hero-orb mobile-hero-orb-coral" aria-hidden="true"></span>
          <span class="mobile-hero-orb mobile-hero-orb-amber" aria-hidden="true"></span>
          <span class="mobile-hero-orb mobile-hero-orb-small" aria-hidden="true"></span>
          <div class="hero-banner-photo">
            <img class="hero-banner-image" src="/images/profissional-limpeza-hero-480.webp"
              srcset="/images/profissional-limpeza-hero-480.webp 480w, /images/profissional-limpeza-hero-887.webp 887w"
              sizes="(min-width: 64rem) 14.3rem, (min-width: 48rem) clamp(15rem, 30vw, 18rem), clamp(13.8rem, 63vw, 16.5rem)"
              alt="Profissional de limpeza sorrindo com luvas e frasco de limpeza" width="887" height="1774" fetchpriority="high">
          </div>
          <div class="hero-banner-shade" aria-hidden="true"></div>
          <div class="hero-banner-copy"><div class="hero-banner-heading"><span class="hero-banner-label">Em destaque</span><span class="hero-banner-proof"><span aria-hidden="true">✓</span> Perfis aprovados</span><h1>Serviços para sua casa, sem complicação.</h1></div><p>Escolha, compare e agende em poucos minutos.</p><a class="btn hero-banner-cta" routerLink="/servicos">Explorar serviços <span aria-hidden="true">→</span></a></div>
        </article>
        <div class="hero-mobile-action"><a class="btn" routerLink="/servicos">Agendar serviço <span aria-hidden="true">→</span></a></div>
      </div>
    </section>
  `,
  styleUrl: './home-hero.component.scss',
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
