import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
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
      <div class="avatar-editor"><cvp-avatar [initials]="user()?.initials || ''" [imageUrl]="user()?.avatarUrl" [label]="user()?.name || 'Foto de perfil'" size="lg" /><div><strong>Foto de perfil</strong><span>JPG, PNG ou WebP · até 5 MB</span><label class="btn btn-secondary btn-small upload-button" [class.is-disabled]="uploading()"><input type="file" accept="image/jpeg,image/png,image/webp" (change)="upload($any($event.target).files?.item(0))" [disabled]="uploading()">{{ uploading() ? 'Enviando…' : 'Trocar foto' }}</label></div></div>
      <form class="identity-form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <label>Nome completo<input formControlName="name" autocomplete="name"></label>
        <label>E-mail<input formControlName="email" autocomplete="email" readonly></label>
        <label>Celular<input type="tel" formControlName="phone" autocomplete="tel"></label>
        <div class="form-actions"><button class="btn btn-primary" type="submit" [disabled]="saving()">{{ saving() ? 'Salvando…' : 'Salvar dados pessoais' }}</button></div>
      </form>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountIdentityComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  readonly user = this.auth.user;
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly success = signal('');
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    name: [this.user()?.name ?? '', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    email: [this.user()?.email ?? ''],
    phone: [this.user()?.phone ?? '', Validators.maxLength(20)]
  });

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
