import type { ActivatedRouteSnapshot } from '@angular/router';

export function authLinkToken(route: ActivatedRouteSnapshot): string {
  const fragmentToken = new URLSearchParams(route.fragment ?? '').get('token');
  return fragmentToken ?? route.queryParamMap.get('token') ?? '';
}
