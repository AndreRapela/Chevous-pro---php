import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BrandComponent } from '../../../shared/components';

@Component({
  selector: 'cvp-auth-shell',
  standalone: true,
  imports: [BrandComponent],
  template: `
    <main class="auth-page" [class.login-auth-page]="variant === 'login'">
      <section
        class="auth-brand-panel"
        [class.login-brand-panel]="variant !== 'register'"
        [class.register-brand-panel]="variant === 'register'"
      >
        <cvp-brand />
        <figure class="auth-professional-visual">
          <img
            [src]="imageSrc"
            [attr.srcset]="imageSrcset || null"
            [attr.sizes]="imageSrcset ? imageSizes : null"
            [alt]="imageAlt"
            [width]="imageWidth"
            [height]="imageHeight"
            decoding="async"
          >
        </figure>
        <div>
          <span class="eyebrow">{{ eyebrow }}</span>
          <h1>{{ heroTitle }}</h1>
          <p>{{ heroDescription }}</p>
        </div>
        <div class="auth-shapes" aria-hidden="true"><span></span><span></span><span></span></div>
      </section>
      <section class="auth-form-panel">
        <div class="auth-form-wrap"><ng-content /></div>
      </section>
    </main>
  `,
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
