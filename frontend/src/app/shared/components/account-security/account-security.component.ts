import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthSessionInfo } from '../../../core/models';
import { LocalizedDatePipe } from '../../localization/localized-format.pipe';

@Component({
  selector: 'cvp-account-security',
  standalone: true,
  imports: [LocalizedDatePipe, ReactiveFormsModule],
  templateUrl: './account-security.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountSecurityComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly sessions = signal<AuthSessionInfo[]>([]);
  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    confirmation: ['', Validators.required]
  });

  ngOnInit(): void {
    this.loadSessions();
  }

  loadSessions(): void {
    this.loading.set(true);
    this.error.set('');
    this.auth.sessions().subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        this.loading.set(false);
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.loading.set(false);
      }
    });
  }

  changePassword(): void {
    this.passwordForm.markAllAsTouched();
    const value = this.passwordForm.getRawValue();
    if (this.passwordForm.invalid || this.acting()) return;
    if (value.newPassword !== value.confirmation) {
      this.error.set('A confirmação da nova senha não confere.');
      return;
    }
    this.acting.set(true);
    this.error.set('');
    this.success.set('');
    this.auth.changePassword(value.currentPassword, value.newPassword).subscribe({
      next: () => {
        this.passwordForm.reset();
        this.success.set('Senha atualizada e outros dispositivos desconectados.');
        this.acting.set(false);
        this.loadSessions();
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.acting.set(false);
      }
    });
  }

  revoke(session: AuthSessionInfo): void {
    if (session.current || this.acting()) return;
    this.acting.set(true);
    this.error.set('');
    this.auth.revokeSession(session.id).subscribe({
      next: () => {
        this.sessions.update((items) => items.filter((item) => item.id !== session.id));
        this.success.set('Dispositivo desconectado.');
        this.acting.set(false);
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.acting.set(false);
      }
    });
  }

  logoutAll(): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.error.set('');
    this.auth.logoutAll().subscribe({
      next: () => {
        void this.router.navigate(['/entrar']);
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.acting.set(false);
      }
    });
  }
}
