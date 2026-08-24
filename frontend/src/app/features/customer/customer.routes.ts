import { Routes } from '@angular/router';

export const customerRoutes: Routes = [
  { path: '', title: 'Meu painel | ChezVoust Pro', loadComponent: () => import('./pages/dashboard/customer-dashboard.component').then((m) => m.CustomerDashboardComponent) },
  { path: 'agendamentos', title: 'Agendamentos | ChezVoust Pro', loadComponent: () => import('./pages/bookings/customer-bookings.component').then((m) => m.CustomerBookingsComponent) },
  { path: 'agendamentos/:id', title: 'Detalhes do agendamento | ChezVoust Pro', loadComponent: () => import('./pages/booking-detail/customer-booking-detail.component').then((m) => m.CustomerBookingDetailComponent) },
  { path: 'mensagens', title: 'Mensagens | ChezVoust Pro', loadComponent: () => import('../messaging/pages/messages/messages.component').then((m) => m.MessagesComponent) },
  { path: 'favoritos', title: 'Favoritos | ChezVoust Pro', loadComponent: () => import('./pages/favorites/customer-favorites.component').then((m) => m.CustomerFavoritesComponent) },
  { path: 'perfil', title: 'Perfil e preferências | ChezVoust Pro', loadComponent: () => import('./pages/profile/customer-profile.component').then((m) => m.CustomerProfileComponent) }
];
