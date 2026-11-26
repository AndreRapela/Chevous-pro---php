import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService, EmailChangeChallenge } from '../../../core/auth/auth.service';
import { AvatarComponent } from '../avatar/avatar.component';
import { avatarFileError } from '../../utils/profile.util';

@Component({
  selector: 'cvp-account-identity',
  standalone: true,
  imports: [AvatarComponent, ReactiveFormsModule],
  template: `
    <section class="portal-card identity-editor">
      <div class="identity-editor-heading"><div><span class="eyebrow">Dados pessoais</span><h2>Sua identidade na plataforma</h2><p>Seu e-mail é protegido; apenas nome e foto aparecem quando necessário.</p></div></div>
      @if (success()) { <div class="alert alert-success" role="status">{{ success() }}</div> }
      @if (error()) { <div class="alert alert-error" role="alert">{{ error() }}</div> }
      <div class="avatar-editor"><cvp-avatar [initials]="user()?.initials || ''" [imageUrl]="$safeNavigationMigration(user()?.avatarUrl)" [label]="user()?.name || 'Foto de perfil'" size="lg" /><div><strong>Foto de perfil</strong><span>JPG, PNG ou WebP · até 5 MB</span><label class="btn btn-secondary btn-small upload-button" [class.is-disabled]="uploading()"><input type="file" accept="image/jpeg,image/png,image/webp" (change)="upload($safeNavigationMigration($any($event.target).files?.item(0)))" [disabled]="uploading()">{{ uploading() ? 'Enviando…' : 'Trocar foto' }}</label></div></div>
      <form class="identity-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <label>Nome completo<input formControlName="name" autocomplete="name"></label>
        <label>E-mail<input formControlName="email" autocomplete="email" readonly></label>
        <div class="email-change-actions">
          @if (pendingEmail(); as address) {
            <p>Confirmação pendente <strong data-cvp-no-localize>{{ address }}</strong></p>
            <button class="btn btn-secondary btn-small" type="button" (click)="openVerification({ email: address })">Continuar confirmação</button>
          }
          <button class="btn btn-secondary btn-small" type="button" (click)="editingEmail.set(true)">Alterar e-mail</button>
        </div>
        <label>Celular<input type="tel" formControlName="phone" autocomplete="tel"></label>
        <div class="form-actions"><button class="btn btn-primary" type="submit" [disabled]="saving()">{{ saving() ? 'Salvando…' : 'Salvar dados pessoais' }}</button></div>
      </form>
      @if (editingEmail()) {
        <form class="identity-form email-change-form" [formGroup]="emailChangeForm" (ngSubmit)="requestEmailChange()" novalidate>
          <h3>Alterar e-mail</h3>
          <p>Você continuará usando o e-mail atual até confirmar o novo.</p>
          @if (emailChangeError()) { <div class="alert alert-error" role="alert">{{ emailChangeError() }}</div> }
          <label>Novo e-mail
            <input type="email" formControlName="email" autocomplete="email" maxlength="190" [attr.aria-invalid]="emailChangeInvalid('email')">
            @if (emailChangeInvalid('email')) { <small class="field-error">Informe um e-mail válido.</small> }
          </label>
          <label>Senha atual
            <input type="password" formControlName="currentPassword" autocomplete="current-password" maxlength="128" [attr.aria-invalid]="emailChangeInvalid('currentPassword')">
            @if (emailChangeInvalid('currentPassword')) { <small class="field-error">Informe sua senha atual.</small> }
          </label>
          <div class="form-actions">
            <button class="btn btn-secondary" type="button" [disabled]="requestingEmail()" (click)="closeEmailEditor()">Cancelar</button>
            <button class="btn btn-primary" type="submit" [disabled]="requestingEmail()">{{ requestingEmail() ? 'Enviando…' : 'Enviar confirmação' }}</button>
          </div>
        </form>
      }
    </section>
  `,
  styles: `
    .email-change-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
    .email-change-actions p { flex-basis: 100%; margin: 0; font-size: .875rem; overflow-wrap: anywhere; }
    .email-change-actions strong { margin-inline-start: .25rem; }
    .email-change-form { padding-top: 1rem; border-top: 1px solid var(--ink-200); }
    .email-change-form :is(h3, p) { margin: 0; }
    .email-change-form .form-actions { margin-top: .2rem; gap: .5rem; flex-wrap: wrap; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountIdentityComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly user = this.auth.user;
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly success = signal('');
  readonly error = signal('');
  readonly editingEmail = signal(false);
  readonly requestingEmail = signal(false);
  readonly pendingEmail = signal<string | null>(null);
  readonly emailChangeError = signal('');
  readonly emailChangeForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(190)]],
    currentPassword: ['', [Validators.required, Validators.maxLength(128)]]
  });
  readonly form = this.fb.nonNullable.group({
    name: [this.user()?.name ?? '', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    email: [this.user()?.email ?? ''],
    phone: [this.user()?.phone ?? '', Validators.maxLength(20)]
  });

  ngOnInit(): void {
    this.auth.pendingEmailChange().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ email }) => this.pendingEmail.set(email),
      error: () => this.pendingEmail.set(null)
    });
  }

  emailChangeInvalid(field: 'email' | 'currentPassword'): boolean {
    const control = this.emailChangeForm.controls[field];
    return control.invalid && control.touched;
  }

  closeEmailEditor(): void {
    this.emailChangeForm.reset();
    this.emailChangeError.set('');
    this.editingEmail.set(false);
  }

  requestEmailChange(): void {
    this.emailChangeForm.markAllAsTouched();
    if (this.emailChangeForm.invalid || this.requestingEmail()) return;
    this.emailChangeError.set('');
    this.requestingEmail.set(true);
    const { email, currentPassword } = this.emailChangeForm.getRawValue();
    this.auth.requestEmailChange(email.trim(), currentPassword).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.requestingEmail.set(false))
    ).subscribe({
      next: (challenge) => {
        this.pendingEmail.set(challenge.email);
        this.closeEmailEditor();
        this.openVerification(challenge);
      },
      error: (failure: Error) => this.emailChangeError.set(failure.message)
    });
  }

  openVerification(challenge: EmailChangeChallenge): void {
    const { email, debugVerificationToken, debugVerificationCode } = challenge;
    void this.router.navigate(['/verificar-email'], {
      queryParams: { alteracao: '1' },
      state: { verificationEmail: email },
      info: environment.production ? undefined : { debugVerificationToken, debugVerificationCode }
    });
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true); this.error.set('');
    const value = this.form.getRawValue();
    this.auth.updateProfile({ name: value.name.trim(), phone: value.phone.trim() || undefined }).subscribe({
      next: (user) => { this.form.patchValue({ name: user.name, email: user.email, phone: user.phone ?? '' }); this.saving.set(false); this.success.set('Dados pessoais atualizados.'); },
      error: (failure: Error) => { this.error.set(failure.message); this.saving.set(false); }
    });
  }

  upload(file: File | null): void {
    const error = avatarFileError(file);
    if (error || !file || this.uploading()) { this.error.set(error ?? 'Aguarde o envio atual terminar.'); return; }
    this.uploading.set(true); this.error.set('');
    this.auth.uploadAvatar(file).subscribe({
      next: () => { this.uploading.set(false); this.success.set('Foto de perfil atualizada.'); },
      error: (failure: Error) => { this.error.set(failure.message); this.uploading.set(false); }
    });
  }
}
