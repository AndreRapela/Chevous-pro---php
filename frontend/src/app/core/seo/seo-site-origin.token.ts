import { DOCUMENT } from '@angular/common';
import { InjectionToken, inject } from '@angular/core';

/** A origem canônica é sobrescrita no SSR a partir dos cabeçalhos encaminhados. */
export const SEO_SITE_ORIGIN = new InjectionToken<string>('SEO_SITE_ORIGIN', {
  providedIn: 'root',
  factory: () => inject(DOCUMENT).location?.origin ?? ''
});
