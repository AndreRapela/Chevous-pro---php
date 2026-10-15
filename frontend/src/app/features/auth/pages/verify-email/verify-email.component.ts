import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthShellComponent } from '../../layout/auth-shell.component';

@Component({
  selector: 'cvp-verify-email',
  standalone: true,
  imports: [AuthShellComponent, RouterLink],
  templateUrl: './verify-email.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VerifyEmailComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';
  readonly loading = signal(true);
  readonly error = signal('');
  ngOnInit(): void {
    if (!this.token) {
      this.error.set('O link de verificação está incompleto.');
      this.loading.set(false);
      return;
    }
    this.auth.verifyEmail(this.token).subscribe({
      next: () => this.loading.set(false),
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.loading.set(false);
      }
    });
  }
}
