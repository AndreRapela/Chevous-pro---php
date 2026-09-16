import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth/auth.guard';
import { adminRoutes } from './features/admin/admin.routes';
import { authRoutes } from './features/auth/auth.routes';
import { customerRoutes } from './features/customer/customer.routes';
import { providerRoutes } from './features/provider/provider.routes';
import { publicRoutes } from './features/public/public.routes';
import { PortalShellComponent } from './layout/portal-shell.component';
import { PublicShellComponent } from './layout/public-shell.component';

export const routes: Routes = [
  {
    path: '',
    component: PublicShellComponent,
    children: publicRoutes
  },
  ...authRoutes,
  {
    path: 'conta', component: PortalShellComponent, canActivate: [authGuard, roleGuard('customer')], data: { portal: 'customer', seo: { noindex: true } },
    children: customerRoutes
  },
  {
    path: 'prestador', component: PortalShellComponent, canActivate: [authGuard, roleGuard('provider')], data: { portal: 'provider', seo: { noindex: true } },
    children: providerRoutes
  },
  {
    path: 'admin', component: PortalShellComponent, canActivate: [authGuard, roleGuard('admin')], data: { portal: 'admin', seo: { noindex: true } },
    children: adminRoutes
  },
  { path: '**', title: 'Página não encontrada | ChezVoust Pro', data: { seo: { title: 'Página não encontrada | ChezVoust Pro', description: 'A página solicitada não foi encontrada.', noindex: true } }, loadComponent: () => import('./features/public/pages/not-found/not-found.component').then((m) => m.NotFoundComponent) }
];
