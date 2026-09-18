import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
      imageSrc="/images/eletricista-login-warm-640.jpg"
      imageSrcset="/images/eletricista-login-warm-640.jpg 640w, /images/eletricista-login-warm-1280.jpg 1280w"
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
            <input type="email" formControlName="email" autocomplete="email" [attr.aria-invalid]="emailInvalid">
            @if (emailInvalid) { <small class="field-error">Informe um e-mail válido.</small> }
          </label>
          <button class="btn btn-primary btn-block" type="submit" [disabled]="sending()">{{ sending() ? 'Enviando…' : 'Enviar instruções' }}</button>
        </form>
      } @else {
        <div class="success-mark">✓</div>
        <h2>Confira seu e-mail</h2>
        <p>Se existir uma conta para <strong>{{ form.controls.email.value }}</strong>, você receberá um link para criar uma nova senha.</p>
        <a class="btn btn-primary btn-block" routerLink="/entrar">Voltar para entrar</a>
      }
    </cvp-auth-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecoverPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  readonly form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]] });
  readonly sent = signal(false);
  readonly sending = signal(false);
  readonly error = signal('');

  get emailInvalid(): boolean {
    const control = this.form.controls.email;
    return control.invalid && control.touched;
  }

  send(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.sending()) return;
    this.sending.set(true);
    this.error.set('');
    this.auth.forgotPassword(this.form.controls.email.value.trim()).subscribe({
      next: () => {
        this.sent.set(true);
        this.sending.set(false);
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.sending.set(false);
      }
    });
  }
}
