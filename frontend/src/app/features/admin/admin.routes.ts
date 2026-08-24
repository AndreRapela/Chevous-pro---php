import { Routes } from '@angular/router';

const table = () => import('./pages/table/admin-table.component').then((m) => m.AdminTableComponent);

export const adminRoutes: Routes = [
  { path: '', title: 'Administração | ChezVoust Pro', loadComponent: () => import('./pages/dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent) },
  { path: 'reservas', title: 'Reservas | Admin', data: { page: 'bookings' }, loadComponent: table },
  { path: 'clientes', title: 'Clientes | Admin', data: { page: 'customers' }, loadComponent: table },
  { path: 'prestadores', title: 'Prestadores | Admin', data: { page: 'providers' }, loadComponent: table },
  { path: 'catalogo', title: 'Catálogo | Admin', data: { page: 'catalog' }, loadComponent: table },
  { path: 'financeiro', title: 'Financeiro | Admin', data: { page: 'finance' }, loadComponent: table },
  { path: 'cupons', title: 'Cupons | Admin', data: { page: 'coupons' }, loadComponent: table },
  { path: 'suporte', title: 'Suporte | Admin', data: { page: 'support' }, loadComponent: table },
  { path: 'configuracoes', title: 'Configurações | Admin', data: { page: 'settings' }, loadComponent: table }
];
