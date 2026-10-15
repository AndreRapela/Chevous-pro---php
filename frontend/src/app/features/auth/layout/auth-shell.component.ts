import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BrandComponent } from '../../../shared/components';

@Component({
  selector: 'cvp-auth-shell',
  standalone: true,
  imports: [BrandComponent],
  templateUrl: './auth-shell.component.html',
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthShellComponent {
  @Input() variant: 'login' | 'register' | 'recovery' = 'login';
  @Input({ required: true }) eyebrow = '';
  @Input({ required: true }) heroTitle = '';
  @Input({ required: true }) heroDescription = '';
  @Input({ required: true }) imageSrc = '';
  @Input() imageSrcset = '';
  // Cover-cropped landscapes need a wider source than the visible half-panel.
  @Input() imageSizes = '100vw';
  @Input({ required: true }) imageAlt = '';
  @Input() imageWidth = 1536;
  @Input() imageHeight = 1024;
}
