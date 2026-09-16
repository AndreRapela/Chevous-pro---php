import { Routes } from '@angular/router';

export const authRoutes: Routes = [
  { path: 'entrar', title: 'Entrar | ChezVoust Pro', data: { seo: { noindex: true } }, loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent) },
  { path: 'cadastro', title: 'Criar conta | ChezVoust Pro', data: { seo: { noindex: true } }, loadComponent: () => import('./pages/register/register.component').then((m) => m.RegisterComponent) },
  { path: 'recuperar-senha', title: 'Recuperar senha | ChezVoust Pro', data: { seo: { noindex: true } }, loadComponent: () => import('./pages/recover-password/recover-password.component').then((m) => m.RecoverPasswordComponent) },
  { path: 'redefinir-senha', title: 'Redefinir senha | ChezVoust Pro', data: { seo: { noindex: true } }, loadComponent: () => import('./pages/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent) },
  { path: 'verificar-email', title: 'Verificar e-mail | ChezVoust Pro', data: { seo: { noindex: true } }, loadComponent: () => import('./pages/verify-email/verify-email.component').then((m) => m.VerifyEmailComponent) }
];
