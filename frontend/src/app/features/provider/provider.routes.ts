import { Routes } from '@angular/router';

export const providerRoutes: Routes = [
  { path: '', title: 'Painel profissional | ChezVoust Pro', loadComponent: () => import('./pages/dashboard/provider-dashboard.component').then((m) => m.ProviderDashboardComponent) },
  { path: 'solicitacoes', title: 'Solicitações | ChezVoust Pro', loadComponent: () => import('./pages/requests/provider-requests.component').then((m) => m.ProviderRequestsComponent) },
  { path: 'agenda', title: 'Agenda profissional | ChezVoust Pro', loadComponent: () => import('./pages/schedule/provider-schedule.component').then((m) => m.ProviderScheduleComponent) },
  { path: 'mensagens', title: 'Mensagens profissionais | ChezVoust Pro', loadComponent: () => import('../messaging/pages/messages/messages.component').then((m) => m.MessagesComponent) },
  { path: 'atividade', title: 'Histórico de serviços | ChezVoust Pro', loadComponent: () => import('./pages/earnings/provider-earnings.component').then((m) => m.ProviderActivityComponent) },
  { path: 'perfil', title: 'Serviços e perfil | ChezVoust Pro', loadComponent: () => import('./pages/profile/provider-profile.component').then((m) => m.ProviderProfileComponent) }
];
