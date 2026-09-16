import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LocalizationService } from './core/localization/localization.service';
import { SeoPage, SeoService } from './core/seo/seo.service';
import { LocalizedContentDirective } from './shared/localization/localized-content.directive';

const DEFAULT_SEO: SeoPage = {
  title: 'ChezVoust Pro | Serviços domésticos com confiança',
  description: 'Encontre profissionais aprovados para cuidar da sua casa no dia e horário que você escolher.',
  canonicalPath: '/'
};

@Component({
  selector: 'cvp-root',
  standalone: true,
  imports: [LocalizedContentDirective, RouterOutlet],
  template: '<div class="app-root" cvpLocalizedContent><router-outlet /></div>',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private readonly localization = inject(LocalizationService);
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private staticSeo: SeoPage = DEFAULT_SEO;

  constructor() {
    effect(() => {
      this.localization.language();
      queueMicrotask(() => this.applyStaticRouteSeo());
    });
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => queueMicrotask(() => {
      this.applyStaticRouteSeo();
    }));
    this.applyStaticRouteSeo();
  }

  private applyStaticRouteSeo(): void {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let seoData: Partial<SeoPage> = {};
    let routeTitle = DEFAULT_SEO.title;
    let noindex = false;
    while (route) {
      const data = route.data['seo'] as Partial<SeoPage> | undefined;
      if (data) seoData = { ...seoData, ...data };
      const title = route.routeConfig?.title;
      if (typeof title === 'string') routeTitle = title;
      noindex ||= data?.noindex === true;
      route = route.firstChild ?? null;
    }
    this.staticSeo = {
      ...DEFAULT_SEO,
      ...seoData,
      noindex,
      title: this.localization.translate(seoData.title ?? routeTitle),
      description: this.localization.translate(seoData.description ?? DEFAULT_SEO.description)
    };
    this.seo.update(this.staticSeo);
  }
}
