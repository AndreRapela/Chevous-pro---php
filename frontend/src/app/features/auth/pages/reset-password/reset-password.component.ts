import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthShellComponent } from '../../layout/auth-shell.component';

@Component({
  selector: 'cvp-reset-password',
  standalone: true,
  imports: [AuthShellComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';
  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmation: ['', Validators.required]
  });
  readonly sending = signal(false);
  readonly success = signal(false);
  readonly error = signal('');
  invalid(name: 'password' | 'confirmation'): boolean {
    const control = this.form.controls[name];
    return (
      (control.invalid && control.touched) ||
      (name === 'confirmation' &&
        control.touched &&
        control.value !== this.form.controls.password.value)
    );
  }
  submit(): void {
    this.form.markAllAsTouched();
    if (
      this.form.invalid ||
      this.form.controls.password.value !== this.form.controls.confirmation.value
    )
      return;
    if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(
        this.form.controls.password.value
      )
    ) {
      this.error.set('A senha ainda não atende aos requisitos de segurança.');
      return;
    }
    if (!this.token) {
      this.error.set('O link de recuperação está incompleto ou expirou.');
      return;
    }
    this.sending.set(true);
    this.error.set('');
    this.auth.resetPassword(this.token, this.form.controls.password.value).subscribe({
      next: () => {
        this.success.set(true);
        this.sending.set(false);
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.sending.set(false);
      }
    });
  }
}
