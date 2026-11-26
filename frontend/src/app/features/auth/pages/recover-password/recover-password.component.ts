import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthShellComponent } from '../../layout/auth-shell.component';

@Component({
  selector: 'cvp-recover-password',
  standalone: true,
  imports: [AuthShellComponent, ReactiveFormsModule, RouterLink],
  template: `
    <cvp-auth-shell
      variant="recovery"
      eyebrow="Acesso protegido"
      heroTitle="Recupere sua conta com tranquilidade."
      heroDescription="Enviaremos as instruções para o e-mail cadastrado, sem expor se a conta existe."
      imageSrc="/images/eletricista-login-v1-640.webp"
      imageSrcset="/images/eletricista-login-v1-640.webp 640w, /images/eletricista-login-v1-1280.webp 1280w"
      imageAlt="Eletricista residencial sorrindo com alicate e multímetro"
    >
      <a class="back-link" routerLink="/entrar"><span aria-hidden="true">←</span> Voltar para entrar</a>
      @if (!sent()) {
        <h2>Recuperar senha</h2>
        <p class="muted">Digite seu e-mail e enviaremos as instruções.</p>
        @if (error()) { <div class="alert alert-error" role="alert">{{ error() }}</div> }
        <form [formGroup]="form" (ngSubmit)="send()" novalidate>
          <label>
            E-mail
            <input type="email" formControlName="email" autocomplete="email" maxlength="190" [attr.aria-invalid]="emailInvalid">
            @if (emailInvalid) { <small class="field-error">Informe um e-mail válido.</small> }
          </label>
          <button class="btn btn-primary btn-block" type="submit" [disabled]="sending()">{{ sending() ? 'Enviando…' : 'Enviar instruções' }}</button>
        </form>
      } @else {
        <div class="success-mark">✓</div>
        <h2>Confira seu e-mail</h2>
        <p>Se existir uma conta para <strong data-cvp-no-localize>{{ form.controls.email.value }}</strong>, você receberá um link para criar uma nova senha.</p>
        <a class="btn btn-primary btn-block" routerLink="/entrar">Voltar para entrar</a>
        @if (testToken(); as token) {
          <p class="auth-switch"><a routerLink="/redefinir-senha" [fragment]="'token=' + token">Abrir link de recuperação de teste</a></p>
        }
      }
    </cvp-auth-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecoverPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly navigationState = inject(Router).currentNavigation()?.extras.state;
  private readonly historyState = inject(Location).getState() as { recoveryEmail?: unknown } | null;
  readonly form = this.fb.nonNullable.group({
    email: [this.emailFromNavigation(), [Validators.required, Validators.email, Validators.maxLength(190)]]
  });
  readonly sent = signal(false);
  readonly sending = signal(false);
  readonly error = signal('');
  readonly testToken = signal<string | undefined>(undefined);

  get emailInvalid(): boolean {
    const control = this.form.controls.email;
    return control.invalid && control.touched;
  }

  send(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.sending()) return;
    this.sending.set(true);
    this.error.set('');
    this.auth.forgotPassword(this.form.controls.email.value.trim()).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.sending.set(false))
    ).subscribe({
      next: (response) => {
        if (!environment.production) this.testToken.set(response?.debugResetToken);
        this.sent.set(true);
      },
      error: (failure: Error) => this.error.set(failure.message)
    });
  }

  private emailFromNavigation(): string {
    const email = this.navigationState?.['recoveryEmail'] ?? this.historyState?.recoveryEmail;
    return typeof email === 'string' ? email : '';
  }
}
