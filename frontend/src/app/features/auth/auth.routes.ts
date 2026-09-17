import { Routes } from '@angular/router';

export const authRoutes: Routes = [
  { path: 'entrar', title: 'Sign in | Pro', data: { seo: { noindex: true } }, loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent) },
  { path: 'cadastro', title: 'Create account | Pro', data: { seo: { noindex: true } }, loadComponent: () => import('./pages/register/register.component').then((m) => m.RegisterComponent) },
  { path: 'recuperar-senha', title: 'Recover password | Pro', data: { seo: { noindex: true } }, loadComponent: () => import('./pages/recover-password/recover-password.component').then((m) => m.RecoverPasswordComponent) },
  { path: 'redefinir-senha', title: 'Reset password | Pro', data: { seo: { noindex: true } }, loadComponent: () => import('./pages/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent) },
  { path: 'verificar-email', title: 'Verify email | Pro', data: { seo: { noindex: true } }, loadComponent: () => import('./pages/verify-email/verify-email.component').then((m) => m.VerifyEmailComponent) }
];
