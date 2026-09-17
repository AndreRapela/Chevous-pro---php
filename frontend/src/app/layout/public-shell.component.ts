import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { BrandComponent } from '../shared/components';
import { LocaleControlsComponent } from '../shared/localization/locale-controls.component';

@Component({
  selector: 'cvp-public-shell',
  standalone: true,
  imports: [BrandComponent, LocaleControlsComponent, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <a class="skip-link" href="#conteudo-principal">Pular para o conteúdo</a>
    <header class="site-header">
      <div class="container header-inner">
        <cvp-brand />
        <nav class="desktop-nav" aria-label="Navegação principal">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Início</a>
          <a routerLink="/servicos" routerLinkActive="active">Serviços</a>
          <a routerLink="/profissionais" routerLinkActive="active">Profissionais</a>
          <a routerLink="/como-funciona" routerLinkActive="active">Como funciona</a>
        </nav>
        <div class="header-actions">
          @if (auth.user(); as user) {
            <a class="user-shortcut" [routerLink]="auth.homeFor(user)" [attr.aria-label]="'Abrir painel de ' + user.name">
              <span class="avatar avatar-sm" aria-hidden="true">{{ user.initials }}</span>
              <span class="desktop-only">Meu painel</span>
            </a>
          } @else {
            <a class="btn btn-ghost desktop-only" routerLink="/entrar">Entrar</a>
            <a class="btn btn-primary" routerLink="/cadastro">Criar conta</a>
          }
          <cvp-locale-controls />
          <button class="menu-button" type="button" (click)="menuOpen.set(!menuOpen())" [attr.aria-expanded]="menuOpen()" aria-controls="mobile-menu" [attr.aria-label]="menuOpen() ? 'Fechar menu' : 'Abrir menu'">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
      @if (menuOpen()) {
        <nav id="mobile-menu" class="mobile-menu" aria-label="Mais opções">
          <a routerLink="/como-funciona" (click)="closeMenu()">Como funciona</a>
          <a routerLink="/seguranca" (click)="closeMenu()">Segurança</a>
          <a routerLink="/ajuda" (click)="closeMenu()">Ajuda</a>
          @if (!auth.user()) { <a routerLink="/entrar" (click)="closeMenu()">Entrar</a><a routerLink="/cadastro" (click)="closeMenu()">Criar conta</a> }
        </nav>
      }
    </header>
    <main id="conteudo-principal" tabindex="-1"><router-outlet /></main>
    <footer class="site-footer">
      <div class="container footer-grid">
        <div><cvp-brand /><p>Cuidado profissional para sua casa, do seu jeito.</p></div>
        <details class="footer-group" open>
          <summary>PRO</summary>
          <div class="footer-links"><a routerLink="/como-funciona">Como funciona</a><a routerLink="/seguranca">Segurança</a><a routerLink="/profissionais">Profissionais</a></div>
        </details>
        <details class="footer-group" open>
          <summary>Atendimento</summary>
          <div class="footer-links"><a routerLink="/ajuda">Central de ajuda</a><a routerLink="/termos">Termos de uso</a><a routerLink="/privacidade">Privacidade</a></div>
        </details>
        <details class="footer-group" open>
          <summary>Para profissionais</summary>
          <div class="footer-links"><a routerLink="/cadastro" [queryParams]="{ tipo: 'profissional' }">Quero prestar serviços</a><a routerLink="/entrar">Acessar painel</a></div>
        </details>
      </div>
      <div class="container footer-bottom"><span>© 2026 Pro</span><span>Feito para servir bem.</span></div>
    </footer>
    <nav class="bottom-nav public-bottom-nav" aria-label="Atalhos do aplicativo">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"><span aria-hidden="true">⌂</span>Início</a>
      <a routerLink="/servicos" routerLinkActive="active"><span aria-hidden="true">⌕</span>Serviços</a>
      <a routerLink="/profissionais" routerLinkActive="active"><span aria-hidden="true">☆</span>Profissionais</a>
      <a [routerLink]="auth.user() ? auth.homeFor() : '/entrar'" routerLinkActive="active"><span aria-hidden="true">○</span>Conta</a>
    </nav>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicShellComponent {
  readonly auth = inject(AuthService);
  readonly menuOpen = signal(false);

  closeMenu(): void { this.menuOpen.set(false); }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.closeMenu(); }
}
