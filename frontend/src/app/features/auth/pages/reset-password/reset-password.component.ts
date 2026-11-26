import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, finalize, map } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiClientError } from '../../../../core/models';
import { authLinkToken } from '../../auth-link-token';
import { AuthShellComponent } from '../../layout/auth-shell.component';

@Component({
  selector: 'cvp-reset-password',
  standalone: true,
  imports: [AuthShellComponent, ReactiveFormsModule, RouterLink],
  template: `
    <cvp-auth-shell variant="recovery" eyebrow="Acesso protegido" heroTitle="Crie uma nova senha." heroDescription="O link é válido por uma hora e só pode ser utilizado uma vez." imageSrc="/images/eletricista-login-v1-640.webp" imageSrcset="/images/eletricista-login-v1-640.webp 640w, /images/eletricista-login-v1-1280.webp 1280w" imageAlt="Eletricista residencial sorrindo com alicate e multímetro">
      <a class="back-link" routerLink="/entrar"><span aria-hidden="true">←</span> Voltar para entrar</a>
      @if (success()) {
        <div class="success-mark" aria-hidden="true">✓</div>
        <h2>Senha atualizada</h2>
        <p>Você já pode entrar usando a nova senha.</p>
        <a class="btn btn-primary btn-block" routerLink="/entrar">Entrar</a>
      } @else if (!usableToken()) {
        <h2>Redefinir senha</h2>
        <p class="alert alert-error" role="alert">O link de recuperação está incompleto ou expirou.</p>
        <a class="btn btn-primary btn-block" routerLink="/recuperar-senha">Solicitar novo link</a>
      } @else {
        <h2>Redefinir senha</h2>
        <p class="muted">Use ao menos oito caracteres, com letras maiúsculas, minúsculas, número e símbolo.</p>
        @if (error()) { <div class="alert alert-error" role="alert">{{ error() }}</div> }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label>Nova senha
            <input type="password" formControlName="password" autocomplete="new-password" maxlength="128" [attr.aria-invalid]="invalid('password')">
            @if (invalid('password')) { <small class="field-error">Informe uma senha forte com ao menos oito caracteres.</small> }
          </label>
          <label>Confirmar senha
            <input type="password" formControlName="confirmation" autocomplete="new-password" maxlength="128" [attr.aria-invalid]="invalid('confirmation')">
            @if (invalid('confirmation')) { <small class="field-error">As senhas precisam ser iguais.</small> }
          </label>
          <button class="btn btn-primary btn-block" type="submit" [disabled]="sending()">{{ sending() ? 'Atualizando…' : 'Atualizar senha' }}</button>
        </form>
      }
    </cvp-auth-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly rejectedToken = signal('');
  private readonly token = toSignal(
    combineLatest([this.route.fragment, this.route.queryParamMap]).pipe(map(() => authLinkToken(this.route.snapshot))),
    { initialValue: authLinkToken(this.route.snapshot) }
  );
  readonly usableToken = computed(() => /^[a-f0-9]{64}$/.test(this.token()) && this.token() !== this.rejectedToken());
  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.maxLength(128), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/)]],
    confirmation: ['', Validators.required]
  });
  readonly sending = signal(false);
  readonly success = signal(false);
  readonly error = signal('');

  invalid(name: 'password' | 'confirmation'): boolean {
    const control = this.form.controls[name];
    return control.touched && (control.invalid || (name === 'confirmation' && control.value !== this.form.controls.password.value));
  }

  submit(): void {
    this.form.markAllAsTouched();
    const { password, confirmation } = this.form.getRawValue();
    if (this.form.invalid || password !== confirmation || !this.usableToken() || this.sending()) return;
    this.sending.set(true);
    this.error.set('');
    const token = this.token();
    this.auth.resetPassword(token, password).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.sending.set(false))
    ).subscribe({
      next: () => {
        this.form.reset();
        this.success.set(true);
      },
      error: (failure: ApiClientError) => {
        if (failure.code === 'INVALID_RESET_TOKEN') this.rejectedToken.set(token);
        else this.error.set(failure.message);
      }
    });
  }
}
