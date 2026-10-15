import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal
} from '@angular/core';
import {
  DisplayCurrency,
  AppLanguage,
  LocalizationService
} from '../../core/localization/localization.service';

@Component({
  selector: 'cvp-locale-controls',
  standalone: true,
  templateUrl: './locale-controls.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LocaleControlsComponent {
  readonly localization = inject(LocalizationService);
  readonly open = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  toggle(): void {
    this.open.update((value) => !value);
  }
  close(): void {
    this.open.set(false);
  }
  chooseLanguage(language: AppLanguage): void {
    this.localization.setLanguage(language);
  }
  chooseCurrency(currency: DisplayCurrency): void {
    this.localization.setCurrency(currency);
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.close();
  }
}
