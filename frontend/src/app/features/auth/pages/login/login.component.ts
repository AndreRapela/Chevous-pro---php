import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiClientError } from '../../../../core/models';
import { AuthShellComponent } from '../../layout/auth-shell.component';

@Component({
  selector: 'cvp-login',
  standalone: true,
  imports: [AuthShellComponent, ReactiveFormsModule, RouterLink],
  template: `
    <cvp-auth-shell
      variant="login"
      eyebrow="Bem-vindo de volta"
      heroTitle="Sua casa e seus serviços em um só lugar."
      heroDescription="Acompanhe reservas, converse com profissionais e cuide dos pagamentos com tranquilidade."
      imageSrc="/images/eletricista-login-v1-640.webp"
      imageSrcset="/images/eletricista-login-v1-640.webp 640w, /images/eletricista-login-v1-1280.webp 1280w"
      imageAlt="Eletricista residencial sorrindo com alicate e multímetro"
    >
      <a class="back-link" routerLink="/"><span aria-hidden="true">←</span> Voltar ao início</a>
      <h2>Entrar</h2>
      <p class="muted">Use seu e-mail e senha para continuar.</p>
      @if (registrationSuccess) {
        <div class="alert alert-success" role="status"><strong>Conta criada.</strong><span>Agora entre para acessar seu painel.</span></div>
      }
      @if (error()) {
        <div class="alert alert-error" role="alert"><strong>Não foi possível entrar.</strong><span>{{ error() }}</span></div>
      }
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label>
          E-mail
          <input type="email" formControlName="email" autocomplete="email" inputmode="email" [attr.aria-invalid]="invalid('email')">
          @if (invalid('email')) { <small class="field-error">Informe um e-mail válido.</small> }
        </label>
        <label>
          Senha
          <span class="label-row"><span></span><a routerLink="/recuperar-senha">Esqueci minha senha</a></span>
          <input type="password" formControlName="password" autocomplete="current-password" [attr.aria-invalid]="invalid('password')">
          @if (invalid('password')) { <small class="field-error">A senha é obrigatória.</small> }
        </label>
        <label class="check-row"><input type="checkbox" formControlName="remember"> <span>Manter acesso neste dispositivo</span></label>
        <button class="btn btn-primary btn-block" type="submit" [disabled]="auth.busy()">{{ auth.busy() ? 'Entrando...' : 'Entrar' }}</button>
      </form>
      <div class="auth-divider"><span>ou acesse a demonstração</span></div>
      <div class="demo-accounts" aria-label="Contas de demonstração">
        <button type="button" (click)="useDemo('customer')"><strong>Cliente</strong><span>cliente&#64;chezvoust.test</span></button>
        <button type="button" (click)="useDemo('provider')"><strong>Profissional</strong><span>profissional&#64;chezvoust.test</span></button>
        <button type="button" (click)="useDemo('admin')"><strong>Admin</strong><span>admin&#64;chezvoust.test</span></button>
      </div>
      <p class="auth-switch">Ainda não tem conta? <a routerLink="/cadastro">Crie sua conta</a></p>
    </cvp-auth-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  readonly error = signal('');
  readonly registrationSuccess = this.route.snapshot.queryParamMap.get('cadastro') === 'sucesso';
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    remember: [false]
  });

  invalid(name: 'email' | 'password'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.form.touched);
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.error.set('');
    const { email, password, remember } = this.form.getRawValue();
    this.auth.login({ email, password, remember }).subscribe({
      next: (user) => {
        const requested = this.route.snapshot.queryParamMap.get('returnUrl');
        const target = requested?.startsWith('/') && !requested.startsWith('//') ? requested : this.auth.homeFor(user);
        void this.router.navigateByUrl(target);
      },
      error: (failure: ApiClientError) => this.error.set(failure.message)
    });
  }

  useDemo(role: 'customer' | 'provider' | 'admin'): void {
    const credentials = {
      customer: ['cliente@chezvoust.test', 'Cliente@123'],
      provider: ['profissional@chezvoust.test', 'Profissional@123'],
      admin: ['admin@chezvoust.test', 'Admin@123']
    } as const;
    const [email, password] = credentials[role];
    this.form.patchValue({ email, password });
    this.submit();
  }
}
