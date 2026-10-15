import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiClientError } from '../../../../core/models';
import { AuthShellComponent } from '../../layout/auth-shell.component';

@Component({
  selector: 'cvp-register',
  standalone: true,
  imports: [AuthShellComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly error = signal('');
  readonly professionalMode = signal(false);
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.minLength(10)]],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)
      ]
    ],
    terms: [false, Validators.requiredTrue]
  });

  ngOnInit(): void {
    this.professionalMode.set(this.route.snapshot.queryParamMap.get('tipo') === 'profissional');
  }

  invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.form.touched);
  }

  toggleMode(): void {
    this.professionalMode.update((value) => !value);
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.error.set('');
    const { name, email, phone, password } = this.form.getRawValue();
    this.auth
      .register({ name, email, phone, password }, this.professionalMode() ? 'provider' : 'customer')
      .subscribe({
        next: () =>
          void this.router.navigate(['/entrar'], { queryParams: { cadastro: 'sucesso' } }),
        error: (failure: ApiClientError) => this.error.set(failure.message)
      });
  }
}
