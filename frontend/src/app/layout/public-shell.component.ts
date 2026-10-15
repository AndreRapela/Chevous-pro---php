import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { BrandComponent } from '../shared/components';
import { LocaleControlsComponent } from '../shared/localization/locale-controls.component';

@Component({
  selector: 'cvp-public-shell',
  standalone: true,
  imports: [BrandComponent, LocaleControlsComponent, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './public-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicShellComponent {
  readonly auth = inject(AuthService);
  readonly menuOpen = signal(false);

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
  }
}
