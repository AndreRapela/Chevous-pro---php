import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '../../core/auth/auth.guard';

export const publicRoutes: Routes = [
  { path: '', title: 'ChezVoust Pro | Serviços domésticos com confiança', loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent) },
  { path: 'servicos', title: 'Serviços | ChezVoust Pro', loadComponent: () => import('./pages/catalog/catalog.component').then((m) => m.CatalogComponent) },
  { path: 'servicos/:slug', title: 'Detalhes do serviço | ChezVoust Pro', loadComponent: () => import('./pages/service-detail/service-detail.component').then((m) => m.ServiceDetailComponent) },
  { path: 'profissionais', title: 'Profissionais | ChezVoust Pro', loadComponent: () => import('./pages/professionals/professionals.component').then((m) => m.ProfessionalsComponent) },
  { path: 'profissionais/:id', title: 'Perfil profissional | ChezVoust Pro', loadComponent: () => import('./pages/provider-detail/provider-detail.component').then((m) => m.ProviderDetailComponent) },
  { path: 'agendar/:serviceId', title: 'Agendar serviço | ChezVoust Pro', canActivate: [authGuard, roleGuard('customer')], loadComponent: () => import('../booking/pages/booking-wizard/booking-wizard.component').then((m) => m.BookingWizardComponent) },
  { path: 'como-funciona', title: 'Como funciona | ChezVoust Pro', data: { page: 'how' }, loadComponent: () => import('./pages/info/info-page.component').then((m) => m.InfoPageComponent) },
  { path: 'seguranca', title: 'Segurança | ChezVoust Pro', data: { page: 'safety' }, loadComponent: () => import('./pages/info/info-page.component').then((m) => m.InfoPageComponent) },
  { path: 'ajuda', title: 'Central de ajuda | ChezVoust Pro', data: { page: 'help' }, loadComponent: () => import('./pages/info/info-page.component').then((m) => m.InfoPageComponent) },
  { path: 'termos', title: 'Termos de uso | ChezVoust Pro', data: { page: 'terms' }, loadComponent: () => import('./pages/info/info-page.component').then((m) => m.InfoPageComponent) },
  { path: 'privacidade', title: 'Privacidade | ChezVoust Pro', data: { page: 'privacy' }, loadComponent: () => import('./pages/info/info-page.component').then((m) => m.InfoPageComponent) }
];
