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
  templateUrl: './login.component.html',
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

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  submit(): void {
    if (this.auth.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.error.set('');
    const { email, password, remember } = this.form.getRawValue();
    this.auth
      .login({ email: email.trim().toLocaleLowerCase('pt-BR'), password, remember })
      .subscribe({
        next: (user) => {
          const requested = this.route.snapshot.queryParamMap.get('returnUrl');
          const target =
            requested?.startsWith('/') && !requested.startsWith('//')
              ? requested
              : this.auth.homeFor(user);
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
