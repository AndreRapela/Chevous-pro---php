import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { BrandComponent } from '../shared/components';
import { LocaleControlsComponent } from '../shared/localization/locale-controls.component';
import { PortalIcon, PortalNavIconComponent } from './portal-nav-icon.component';

@Component({
  selector: 'cvp-public-shell',
  standalone: true,
  imports: [BrandComponent, LocaleControlsComponent, PortalNavIconComponent, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <a class="skip-link" href="#conteudo-principal">Pular para o conteúdo</a>
    <header class="site-header">
      <div class="container header-inner">
        <cvp-brand />
        <nav class="desktop-nav" aria-label="Navegação principal">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Início</a>
          <a routerLink="/servicos" routerLinkActive="active">Serviços</a>
          <a routerLink="/produtos" routerLinkActive="active">Produtos</a>
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
            <a class="btn btn-primary header-create-account" routerLink="/cadastro">Criar conta</a>
          }
          <cvp-locale-controls />
          <button #menuButton class="menu-button" type="button" (click)="openMenu(menuPanel)" [attr.aria-expanded]="menuOpen()" aria-haspopup="dialog" aria-controls="mobile-menu" aria-label="Abrir menu">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </header>
    <dialog #menuPanel id="mobile-menu" class="mobile-drawer" aria-label="Navegação principal" (close)="menuOpen.set(false)"
      (pointerdown)="backdropPressed = $event.target === menuPanel" (pointerup)="closeFromBackdrop($event, menuPanel)">
      <div class="mobile-drawer-content">
        <button class="mobile-drawer-close" type="button" aria-label="Fechar menu" (click)="menuPanel.close()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </button>
        <div class="mobile-drawer-account">
          @if (auth.user(); as user) {
            <a class="btn btn-primary" [routerLink]="auth.homeFor(user)" (click)="menuPanel.close()">Meu painel</a>
          } @else {
            <a class="btn btn-primary" routerLink="/cadastro" (click)="menuPanel.close()">Criar conta</a>
            <a class="btn btn-secondary" routerLink="/entrar" (click)="menuPanel.close()">Entrar</a>
          }
        </div>
        <nav class="mobile-drawer-links" aria-label="Navegação principal">
          @for (item of mobileLinks; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/' }"
              ariaCurrentWhenActive="page" (click)="menuPanel.close()">
              <cvp-portal-nav-icon [icon]="item.icon" />{{ item.label }}
              <svg class="mobile-drawer-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg>
            </a>
          }
        </nav>
      </div>
    </dialog>
    <main id="conteudo-principal" tabindex="-1">
      <router-outlet />
    </main>
    <footer class="site-footer">
      <div class="container footer-grid">
        <div><cvp-brand /><p>Cuidado profissional para sua casa, do seu jeito.</p></div>
        <div class="footer-group footer-desktop-group">
          <h2 data-cvp-no-localize>ChezVoust Pro</h2>
          <div class="footer-links"><a routerLink="/como-funciona">Como funciona</a><a routerLink="/produtos">Produtos</a><a routerLink="/seguranca">Segurança</a><a routerLink="/profissionais">Profissionais</a></div>
        </div>
        <div class="footer-group footer-desktop-group">
          <h2>Atendimento</h2>
          <div class="footer-links"><a routerLink="/ajuda">Central de ajuda</a><a routerLink="/termos">Termos de uso</a><a routerLink="/privacidade">Privacidade</a></div>
        </div>
        <div class="footer-group footer-desktop-group">
          <h2>Para profissionais</h2>
          <div class="footer-links"><a routerLink="/cadastro" [queryParams]="{ tipo: 'profissional' }">Quero prestar serviços</a><a routerLink="/entrar">Acessar painel</a></div>
        </div>
        <details class="footer-group footer-mobile-group">
          <summary data-cvp-no-localize>ChezVoust Pro</summary>
          <div class="footer-links"><a routerLink="/como-funciona">Como funciona</a><a routerLink="/produtos">Produtos</a><a routerLink="/seguranca">Segurança</a><a routerLink="/profissionais">Profissionais</a></div>
        </details>
        <details class="footer-group footer-mobile-group">
          <summary>Atendimento</summary>
          <div class="footer-links"><a routerLink="/ajuda">Central de ajuda</a><a routerLink="/termos">Termos de uso</a><a routerLink="/privacidade">Privacidade</a></div>
        </details>
        <details class="footer-group footer-mobile-group">
          <summary>Para profissionais</summary>
          <div class="footer-links"><a routerLink="/cadastro" [queryParams]="{ tipo: 'profissional' }">Quero prestar serviços</a><a routerLink="/entrar">Acessar painel</a></div>
        </details>
      </div>
      <div class="container footer-bottom"><span data-cvp-no-localize>© 2026 ChezVoust Pro</span><span>Feito para servir bem.</span></div>
    </footer>
    <nav class="bottom-nav public-bottom-nav" aria-label="Atalhos do aplicativo">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"><span aria-hidden="true">⌂</span>Início</a>
      <a routerLink="/servicos" routerLinkActive="active"><span aria-hidden="true">⌕</span>Serviços</a>
      <a routerLink="/profissionais" routerLinkActive="active"><span aria-hidden="true">☆</span>Profissionais</a>
      <a [routerLink]="auth.user() ? auth.homeFor() : '/entrar'" routerLinkActive="active"><span aria-hidden="true">○</span>Conta</a>
    </nav>
  `,
  styleUrl: './public-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicShellComponent {
  readonly auth = inject(AuthService);
  readonly menuOpen = signal(false);
  readonly mobileLinks: ReadonlyArray<{ path: string; label: string; icon: PortalIcon }> = [
    { path: '/', label: 'Início', icon: 'home' },
    { path: '/servicos', label: 'Serviços', icon: 'catalog' },
    { path: '/produtos', label: 'Produtos', icon: 'bag' },
    { path: '/profissionais', label: 'Profissionais', icon: 'profile' },
    { path: '/como-funciona', label: 'Como funciona', icon: 'info' },
    { path: '/seguranca', label: 'Segurança', icon: 'moderation' },
    { path: '/ajuda', label: 'Ajuda', icon: 'help' }
  ];
  backdropPressed = false;
  private readonly menuPanel = viewChild<ElementRef<HTMLDialogElement>>('menuPanel');
  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');

  openMenu(panel: HTMLDialogElement): void {
    panel.showModal();
    this.menuOpen.set(true);
  }

  closeFromBackdrop(event: PointerEvent, panel: HTMLDialogElement): void {
    if (this.backdropPressed && event.target === panel) panel.close();
    this.backdropPressed = false;
  }

  @HostListener('window:resize')
  closeMenuOnDesktop(): void {
    const panel = this.menuPanel()?.nativeElement;
    const trigger = this.menuButton()?.nativeElement;
    if (panel?.open && trigger && getComputedStyle(trigger).display === 'none') panel.close();
  }
}
