import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthShellComponent } from '../../layout/auth-shell.component';

@Component({
  selector: 'cvp-recover-password',
  standalone: true,
  imports: [AuthShellComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './recover-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecoverPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });
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
