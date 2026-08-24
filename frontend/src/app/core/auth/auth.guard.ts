import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { UserRole } from '../models';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.authenticated()
    ? true
    : inject(Router).createUrlTree(['/entrar'], { queryParams: { returnUrl: state.url } });
};

export function roleGuard(...roles: UserRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const user = auth.user();
    if (!user) return inject(Router).createUrlTree(['/entrar']);
    return roles.includes(user.role) ? true : inject(Router).createUrlTree([auth.homeFor(user)]);
  };
}
