import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthShellComponent } from '../../layout/auth-shell.component';

@Component({
  selector: 'cvp-reset-password',
  standalone: true,
  imports: [AuthShellComponent, ReactiveFormsModule, RouterLink],
  template: `
    <cvp-auth-shell variant="recovery" eyebrow="Acesso protegido" heroTitle="Crie uma nova senha." heroDescription="O link é válido por uma hora e só pode ser utilizado uma vez." imageSrc="/images/eletricista-login-warm-640.jpg" imageSrcset="/images/eletricista-login-warm-640.jpg 640w, /images/eletricista-login-warm-1280.jpg 1280w" imageAlt="Eletricista residencial sorrindo com alicate e multímetro">
      <a class="back-link" routerLink="/entrar"><span aria-hidden="true">←</span> Voltar para entrar</a>
      @if (success()) { <div class="success-mark">✓</div><h2>Senha atualizada</h2><p>Você já pode entrar usando a nova senha.</p><a class="btn btn-primary btn-block" routerLink="/entrar">Entrar</a> }
      @else { <h2>Redefinir senha</h2><p class="muted">Use ao menos oito caracteres, com letras maiúsculas, minúsculas, número e símbolo.</p>@if (error()) { <div class="alert alert-error" role="alert">{{ error() }}</div> }<form [formGroup]="form" (ngSubmit)="submit()" novalidate><label>Nova senha<input type="password" formControlName="password" autocomplete="new-password" [attr.aria-invalid]="invalid('password')">@if (invalid('password')) { <small class="field-error">Informe uma senha forte com ao menos oito caracteres.</small> }</label><label>Confirmar senha<input type="password" formControlName="confirmation" autocomplete="new-password" [attr.aria-invalid]="invalid('confirmation')">@if (invalid('confirmation')) { <small class="field-error">As senhas precisam ser iguais.</small> }</label><button class="btn btn-primary btn-block" type="submit" [disabled]="sending()">{{ sending() ? 'Atualizando…' : 'Atualizar senha' }}</button></form> }
    </cvp-auth-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';
  readonly form = this.fb.nonNullable.group({ password: ['', [Validators.required, Validators.minLength(8)]], confirmation: ['', Validators.required] });
  readonly sending = signal(false); readonly success = signal(false); readonly error = signal('');
  invalid(name: 'password' | 'confirmation'): boolean { const control = this.form.controls[name]; return (control.invalid && control.touched) || (name === 'confirmation' && control.touched && control.value !== this.form.controls.password.value); }
  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.form.controls.password.value !== this.form.controls.confirmation.value) return;
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(this.form.controls.password.value)) { this.error.set('A senha ainda não atende aos requisitos de segurança.'); return; }
    if (!this.token) { this.error.set('O link de recuperação está incompleto ou expirou.'); return; }
    this.sending.set(true); this.error.set('');
    this.auth.resetPassword(this.token, this.form.controls.password.value).subscribe({ next: () => { this.success.set(true); this.sending.set(false); }, error: (failure: Error) => { this.error.set(failure.message); this.sending.set(false); } });
  }
}
