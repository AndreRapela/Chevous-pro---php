import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { DisplayCurrency, AppLanguage, LocalizationService } from '../../core/localization/localization.service';

@Component({
  selector: 'cvp-locale-controls',
  standalone: true,
  template: `
    <div class="locale-picker">
      <button class="locale-trigger" type="button" aria-haspopup="dialog" aria-controls="locale-preferences" aria-label="Preferências de idioma e moeda" [attr.aria-expanded]="open()" [class.open]="open()" (click)="toggle()">
        <svg class="locale-trigger-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.4 2.45 3.65 5.45 3.65 9S14.4 18.55 12 21M12 3C9.6 5.45 8.35 8.45 8.35 12S9.6 18.55 12 21" />
        </svg>
        <span class="locale-trigger-value">{{ localization.language().toUpperCase() }} · {{ localization.currency() }}</span>
        <svg class="locale-trigger-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </button>

      @if (open()) {
        <section id="locale-preferences" class="locale-popover" role="dialog" aria-label="Preferências de idioma e moeda">
          <header class="locale-popover-header">
            <div><span>Preferências</span><strong>Idioma e moeda</strong></div>
            <button class="locale-close" type="button" aria-label="Fechar preferências" (click)="close()">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
            </button>
          </header>

          <div class="locale-setting" role="group" aria-label="Idioma">
            <span class="locale-setting-label">Idioma</span>
            <div class="locale-option-grid">
              <button type="button" class="locale-option" [class.active]="localization.language() === 'en'" [attr.aria-pressed]="localization.language() === 'en'" (click)="chooseLanguage('en')"><span class="locale-code">EN</span><span>Inglês</span></button>
              <button type="button" class="locale-option" [class.active]="localization.language() === 'fr'" [attr.aria-pressed]="localization.language() === 'fr'" (click)="chooseLanguage('fr')"><span class="locale-code">FR</span><span>Francês</span></button>
            </div>
          </div>

          <div class="locale-setting" role="group" aria-label="Moeda">
            <span class="locale-setting-label">Moeda</span>
            <div class="locale-option-grid">
              <button type="button" class="locale-option" [class.active]="localization.currency() === 'EUR'" [attr.aria-pressed]="localization.currency() === 'EUR'" (click)="chooseCurrency('EUR')"><span class="locale-code">€</span><span>Euro</span></button>
              <button type="button" class="locale-option" [class.active]="localization.currency() === 'USD'" [attr.aria-pressed]="localization.currency() === 'USD'" (click)="chooseCurrency('USD')"><span class="locale-code">$</span><span>Dólar americano</span></button>
            </div>
          </div>
        </section>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LocaleControlsComponent {
  readonly localization = inject(LocalizationService);
  readonly open = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  toggle(): void { this.open.update((value) => !value); }
  close(): void { this.open.set(false); }
  chooseLanguage(language: AppLanguage): void { this.localization.setLanguage(language); }
  chooseCurrency(currency: DisplayCurrency): void { this.localization.setCurrency(currency); }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void { this.close(); }
}
