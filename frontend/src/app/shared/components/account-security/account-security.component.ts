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
  template: `
    <section class="portal-card account-security" aria-labelledby="account-security-title">
      <div class="card-title-row"><div><span class="eyebrow">Proteção da conta</span><h2 id="account-security-title">Senha e dispositivos</h2></div><span class="chip chip-soft">Sessão protegida</span></div>
      @if (success()) { <div class="alert alert-success" role="status">{{ success() }}</div> }
      @if (error()) { <div class="alert alert-error" role="alert">{{ error() }}</div> }
      <form class="security-password-form" [formGroup]="passwordForm" (ngSubmit)="changePassword()" novalidate>
        <h3>Alterar senha</h3>
        <div class="form-grid">
          <label>Senha atual<input type="password" formControlName="currentPassword" autocomplete="current-password"></label>
          <label>Nova senha<input type="password" formControlName="newPassword" autocomplete="new-password" aria-describedby="password-help"></label>
          <label>Confirmar nova senha<input type="password" formControlName="confirmation" autocomplete="new-password"></label>
        </div>
        <p id="password-help" class="form-help">Use no mínimo 8 caracteres, com maiúscula, minúscula, número e símbolo.</p>
        <button class="btn btn-primary btn-small" type="submit" [disabled]="acting()">{{ acting() ? 'Atualizando…' : 'Atualizar senha' }}</button>
      </form>
      <div class="security-sessions">
        <div class="card-title-row"><div><h3>Dispositivos conectados</h3><p class="muted">Revogue acessos que você não reconhece.</p></div><button class="text-button" type="button" [disabled]="loading()" (click)="loadSessions()">Atualizar</button></div>
        @if (loading()) { <p class="muted" role="status">Carregando sessões…</p> }
        @else { <div class="session-list">@for (session of sessions(); track session.id) { <article><div><strong>{{ session.device }} @if (session.current) { <span class="chip chip-soft">Este dispositivo</span> }</strong><p>{{ session.ipAddress || 'IP não informado' }} · atividade em {{ (session.lastUsedAt || session.createdAt) | appDate:'MMM d, yyyy HH:mm' }}</p></div>@if (!session.current) { <button class="btn btn-secondary btn-small" type="button" [disabled]="acting()" (click)="revoke(session)">Desconectar</button> }</article> } @empty { <p class="muted">Nenhuma sessão ativa encontrada.</p> }</div> }
        <button class="text-button danger-text" type="button" [disabled]="acting()" (click)="logoutAll()">Sair de todos os dispositivos</button>
      </div>
    </section>
  `,
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

  ngOnInit(): void { this.loadSessions(); }

  loadSessions(): void {
    this.loading.set(true); this.error.set('');
    this.auth.sessions().subscribe({
      next: (sessions) => { this.sessions.set(sessions); this.loading.set(false); },
      error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); }
    });
  }

  changePassword(): void {
    this.passwordForm.markAllAsTouched();
    const value = this.passwordForm.getRawValue();
    if (this.passwordForm.invalid || this.acting()) return;
    if (value.newPassword !== value.confirmation) { this.error.set('A confirmação da nova senha não confere.'); return; }
    this.acting.set(true); this.error.set(''); this.success.set('');
    this.auth.changePassword(value.currentPassword, value.newPassword).subscribe({
      next: () => { this.passwordForm.reset(); this.success.set('Senha atualizada e outros dispositivos desconectados.'); this.acting.set(false); this.loadSessions(); },
      error: (failure: Error) => { this.error.set(failure.message); this.acting.set(false); }
    });
  }

  revoke(session: AuthSessionInfo): void {
    if (session.current || this.acting()) return;
    this.acting.set(true); this.error.set('');
    this.auth.revokeSession(session.id).subscribe({
      next: () => { this.sessions.update((items) => items.filter((item) => item.id !== session.id)); this.success.set('Dispositivo desconectado.'); this.acting.set(false); },
      error: (failure: Error) => { this.error.set(failure.message); this.acting.set(false); }
    });
  }

  logoutAll(): void {
    if (this.acting()) return;
    this.acting.set(true); this.error.set('');
    this.auth.logoutAll().subscribe({
      next: () => { void this.router.navigate(['/entrar']); },
      error: (failure: Error) => { this.error.set(failure.message); this.acting.set(false); }
    });
  }
}
