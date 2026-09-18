import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiClientError } from '../../../../core/models';
import { AuthShellComponent } from '../../layout/auth-shell.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'cvp-login',
  standalone: true,
  imports: [AuthShellComponent, ReactiveFormsModule, RouterLink],
  template: `
    <cvp-auth-shell
      variant="login"
      eyebrow="Bem-vindo de volta"
      heroTitle="Sua casa e seus serviços em um só lugar."
      heroDescription="Acompanhe reservas, converse com profissionais e organize seus serviços com tranquilidade."
      imageSrc="/images/eletricista-login-warm-640.jpg"
      imageSrcset="/images/eletricista-login-warm-640.jpg 640w, /images/eletricista-login-warm-1280.jpg 1280w"
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
          <input type="email" formControlName="email" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" [attr.aria-invalid]="invalid('email')">
          @if (invalid('email')) { <small class="field-error">Informe um e-mail válido.</small> }
        </label>
        <label>
          <span class="label-row"><span>Senha</span><a routerLink="/recuperar-senha">Esqueci minha senha</a></span>
          <span class="password-input"><input [type]="passwordVisible() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" [attr.aria-invalid]="invalid('password')"><button type="button" (click)="togglePasswordVisibility()" [attr.aria-label]="passwordVisible() ? 'Ocultar senha' : 'Mostrar senha'" [attr.aria-pressed]="passwordVisible()">{{ passwordVisible() ? 'Ocultar' : 'Mostrar' }}</button></span>
          @if (invalid('password')) { <small class="field-error">A senha é obrigatória.</small> }
        </label>
        <label class="check-row"><input type="checkbox" formControlName="remember"> <span>Manter acesso neste dispositivo</span></label>
        <button class="btn btn-primary btn-block" type="submit" [disabled]="auth.busy()">{{ auth.busy() ? 'Entrando...' : 'Entrar' }}</button>
      </form>
      @if (demoAccounts) {
        <div class="auth-divider"><span>ou acesse a demonstração</span></div>
        <div class="demo-accounts" aria-label="Contas de demonstração">
          <button type="button" [disabled]="auth.busy()" (click)="useDemo('customer')"><strong>Cliente</strong><span data-cvp-no-localize>{{ demoAccounts.customer[0] }}</span></button>
          <button type="button" [disabled]="auth.busy()" (click)="useDemo('provider')"><strong>Profissional</strong><span data-cvp-no-localize>{{ demoAccounts.provider[0] }}</span></button>
          <button type="button" [disabled]="auth.busy()" (click)="useDemo('admin')"><strong>Admin</strong><span data-cvp-no-localize>{{ demoAccounts.admin[0] }}</span></button>
        </div>
      }
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
  readonly passwordVisible = signal(false);
  readonly demoAccounts = environment.demoAccounts;
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

  togglePasswordVisibility(): void { this.passwordVisible.update((visible) => !visible); }

  submit(): void {
    if (this.auth.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.error.set('');
    const { email, password, remember } = this.form.getRawValue();
    this.auth.login({ email: email.trim().toLocaleLowerCase('pt-BR'), password, remember }).subscribe({
      next: (user) => {
        const requested = this.route.snapshot.queryParamMap.get('returnUrl');
        const target = requested?.startsWith('/') && !requested.startsWith('//') ? requested : this.auth.homeFor(user);
        void this.router.navigateByUrl(target);
      },
      error: (failure: ApiClientError) => this.error.set(failure.message)
    });
  }

  useDemo(role: 'customer' | 'provider' | 'admin'): void {
    const credentials = this.demoAccounts?.[role];
    if (!credentials) return;
    const [email, password] = credentials;
    this.form.patchValue({ email, password });
    this.submit();
  }
}
