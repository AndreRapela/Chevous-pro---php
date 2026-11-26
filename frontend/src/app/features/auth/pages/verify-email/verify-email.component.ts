import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, combineLatest, distinctUntilChanged, finalize, map, of, switchMap } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { AuthService, EmailChangeChallenge } from '../../../../core/auth/auth.service';
import { authLinkToken } from '../../auth-link-token';
import { AuthShellComponent } from '../../layout/auth-shell.component';

interface VerificationPreview {
  debugVerificationCode?: string;
  debugVerificationToken?: string;
}

interface VerificationState {
  verificationEmail?: unknown;
  verificationSource?: unknown;
}

@Component({
  selector: 'cvp-verify-email',
  standalone: true,
  imports: [AuthShellComponent, ReactiveFormsModule, RouterLink],
  template: `
    <cvp-auth-shell
      variant="register"
      eyebrow="Confirmação de cadastro"
      heroTitle="Confirme seu endereço de e-mail."
      heroDescription="A verificação protege sua conta e confirma que você controla o endereço informado."
      imageSrc="/images/garconete-cadastro-v1-640.webp"
      imageSrcset="/images/garconete-cadastro-v1-640.webp 640w, /images/garconete-cadastro-v1-1086.webp 1086w"
      imageAlt="Garçonete profissional sorrindo com uma bandeja"
      [imageWidth]="1086"
      [imageHeight]="1448"
    >
      @if (loadingLink()) {
        <h2>Verificando e-mail…</h2>
        <p class="muted" role="status">Aguarde um instante.</p>
      } @else if (verified()) {
        <div class="success-mark" aria-hidden="true">✓</div>
        <div class="verification-heading">
          @if (emailChange()) {
            <h2>Novo e-mail confirmado</h2>
            <p>Use o novo endereço para entrar na sua conta.</p>
          } @else {
            <h2>E-mail verificado</h2>
            <p>Sua conta está pronta para ser utilizada.</p>
          }
        </div>
        @if (emailChange() && profilePath()) {
          <a class="btn btn-primary btn-block" [routerLink]="profilePath()">Voltar ao perfil</a>
        } @else if (!emailChange() && accountPath(); as path) {
          <a class="btn btn-primary btn-block" [routerLink]="path">Acessar minha conta</a>
        } @else {
          <a class="btn btn-primary btn-block" routerLink="/entrar">Entrar</a>
        }
      } @else {
        <div class="verification-heading">
          <span class="verification-envelope" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
              <path d="m3.5 7 8.5 6 8.5-6" />
            </svg>
          </span>
          <h2>{{ emailChange() ? 'Confirme seu novo e-mail' : 'Confirme seu e-mail' }}</h2>
          @if (knownEmail(); as address) {
            <p class="verification-address" data-cvp-no-localize>{{ address }}</p>
          }
          @if (canEnterCode()) {
            <p>Digite o código de seis dígitos ou use o link de confirmação enviado por e-mail.</p>
          }
        </div>
        @if (error()) { <div class="alert alert-error" role="alert">{{ error() }}</div> }
        @if (resent()) { <p class="alert alert-success" role="status">Novo código e link solicitados.</p> }
        @if (canEnterCode()) {
          <form class="verification-form" [formGroup]="form" (ngSubmit)="verifyCode()" novalidate>
            <label>
              Código de confirmação
              <input class="verification-code" type="text" formControlName="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" [attr.aria-invalid]="invalidCode()">
              @if (invalidCode()) { <small class="field-error">Digite os seis números do código.</small> }
            </label>
            <button class="btn btn-primary btn-block" type="submit" [disabled]="verifying() || resending()">{{ verifying() ? 'Verificando e-mail…' : 'Confirmar código' }}</button>
          </form>
          <div class="verification-resend">
            <p>Não recebeu o e-mail? Confira a pasta de spam.</p>
            <button class="btn btn-secondary btn-block" type="button" (click)="resend()" [disabled]="resending() || verifying()">{{ resending() ? 'Enviando…' : 'Reenviar confirmação de e-mail' }}</button>
            @if (previewCode(); as code) {
              <p class="verification-preview">Código de teste <strong data-cvp-no-localize>{{ code }}</strong></p>
            }
            @if (previewToken(); as token) {
              <a class="verification-test-link" [href]="(emailChange() ? '/verificar-email?alteracao=1' : '/verificar-email') + '#token=' + token">Confirmar e-mail de teste</a>
            }
            @if (emailChange() && profilePath()) {
              <a class="verification-test-link" [routerLink]="profilePath()">Voltar ao perfil</a>
            }
          </div>
        } @else {
          <p>Entre na sua conta para digitar o código ou pedir outro e-mail.</p>
          <a class="btn btn-primary btn-block" routerLink="/entrar" [queryParams]="emailChange() ? { returnUrl: '/verificar-email?alteracao=1' } : null">Entrar</a>
        }
      }
    </cvp-auth-shell>
  `,
  styles: `
    .verification-heading { text-align: center; }
    .verification-heading h2 { margin: .75rem 0 .55rem; font-size: clamp(1.4rem, 3vw, 1.8rem); }
    .verification-heading p { margin-bottom: .7rem; font-size: .875rem; overflow-wrap: anywhere; }
    .verification-envelope {
      display: grid;
      width: 3.5rem;
      aspect-ratio: 1;
      place-items: center;
      margin: .25rem auto 0;
      border: 1px solid var(--brand-200);
      border-radius: 1.15rem;
      background: var(--brand-50);
      color: var(--brand-800);
    }
    .verification-address {
      width: fit-content;
      max-width: 100%;
      margin-inline: auto;
      padding: .3rem .65rem;
      border-radius: var(--radius-sm);
      background: var(--brand-50);
      color: var(--brand-900);
      font-weight: 700;
    }
    .verification-form .verification-code {
      min-height: 2.75rem;
      font-size: 1.25rem;
      letter-spacing: .3em;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .verification-resend { display: grid; gap: .5rem; margin-top: .9rem; text-align: center; }
    .verification-resend p { margin: 0; font-size: .875rem; }
    .verification-preview { padding-block: .35rem; }
    .verification-preview strong { font-variant-numeric: tabular-nums; }
    .verification-test-link { color: var(--brand-800); font-size: .875rem; text-decoration: underline; text-underline-offset: .2em; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VerifyEmailComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);
  private readonly preview = environment.production ? undefined : this.router.currentNavigation()?.extras.info as VerificationPreview | undefined;
  private readonly flow = signal(this.verificationContext());
  readonly emailChange = signal(this.route.snapshot.queryParamMap.get('alteracao') === '1');
  readonly signedIn = this.auth.authenticated;
  private readonly otherRegistration = computed(() => {
    const user = this.auth.user();
    const flow = this.flow();
    return !this.emailChange() && !!user && flow.registration && user.email !== flow.email;
  });
  readonly knownEmail = computed(() => {
    const { email } = this.flow();
    if (this.emailChange()) return this.signedIn() ? email : '';
    if (this.otherRegistration()) return email;
    const user = this.auth.user();
    if (user) return user.emailVerified === false ? user.email : '';
    return email;
  });
  readonly canEnterCode = computed(() => this.emailChange() ? this.signedIn() : !!this.knownEmail());
  readonly accountPath = computed(() => {
    const user = this.auth.user();
    return this.signedIn() && !this.otherRegistration() && user?.emailVerified === true ? this.auth.homeFor(user) : null;
  });
  readonly profilePath = computed(() => {
    const user = this.auth.user();
    return user?.role === 'customer' || user?.role === 'provider' ? this.auth.homeFor(user) + '/perfil' : null;
  });
  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]]
  });
  readonly previewCode = signal(this.preview?.debugVerificationCode);
  readonly previewToken = signal(this.preview?.debugVerificationToken);
  readonly loadingLink = signal(Boolean(authLinkToken(this.route.snapshot)));
  readonly verified = signal(false);
  readonly verifying = signal(false);
  readonly resending = signal(false);
  readonly resent = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    combineLatest([this.route.fragment, this.route.queryParamMap]).pipe(
      map(() => ({
        token: authLinkToken(this.route.snapshot),
        change: this.route.snapshot.queryParamMap.get('alteracao') === '1'
      })),
      distinctUntilChanged((a, b) => a.token === b.token && a.change === b.change),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ token, change }) => {
      this.emailChange.set(change);
      this.flow.set(this.verificationContext());
      if (token) {
        this.confirm(change ? this.auth.confirmEmailChange({ token }) : this.auth.verifyEmail(token), true);
      } else if (!change && !this.canEnterCode() && !this.verified()) {
        void this.router.navigateByUrl(this.accountPath() ?? '/entrar', { replaceUrl: true });
      }
    });
  }

  invalidCode(): boolean {
    const control = this.form.controls.code;
    return control.invalid && control.touched;
  }

  verifyCode(): void {
    const change = this.emailChange();
    const code = this.form.controls.code;
    code.markAsTouched();
    if (code.invalid || !this.canEnterCode() || this.verifying() || this.resending()) return;
    this.confirm(change ? this.auth.confirmEmailChange({ code: code.value }) : this.auth.verifyEmailCode(this.knownEmail(), code.value));
  }

  resend(): void {
    const change = this.emailChange();
    if (!this.canEnterCode() || this.resending() || this.verifying()) return;
    this.resending.set(true);
    this.error.set('');
    this.resent.set(false);
    const request: Observable<EmailChangeChallenge | void> = change
      ? this.auth.resendEmailChange()
      : this.auth.resendEmailVerification(this.knownEmail());
    request.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.resending.set(false))
    ).subscribe({
      next: (challenge) => {
        this.resent.set(true);
        if (challenge) {
          this.flow.update((flow) => ({ ...flow, email: challenge.email }));
          this.previewCode.set(environment.production ? undefined : challenge.debugVerificationCode);
          this.previewToken.set(environment.production ? undefined : challenge.debugVerificationToken);
        } else {
          this.previewCode.set(undefined);
        }
        this.form.controls.code.reset();
      },
      error: (failure: Error) => this.error.set(failure.message)
    });
  }

  private confirm(request: Observable<void>, fromLink = false): void {
    if (this.verifying() || this.verified()) return;
    this.verifying.set(true);
    this.loadingLink.set(fromLink);
    this.error.set('');
    this.resent.set(false);
    request.pipe(
      switchMap(() => this.signedIn() && !this.otherRegistration()
        ? this.auth.refreshProfile().pipe(catchError(() => of(null)))
        : of(null)),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.verifying.set(false);
        this.loadingLink.set(false);
      })
    ).subscribe({
      next: () => this.verified.set(true),
      error: (failure: Error) => this.error.set(failure.message)
    });
  }

  private verificationContext(): { email: string; registration: boolean } {
    const navigationState = this.router.currentNavigation()?.extras.state as VerificationState | undefined;
    const historyState = this.location.getState() as VerificationState | null;
    const state = navigationState?.verificationEmail ? navigationState : historyState;
    const address = state?.verificationEmail;
    const email = typeof address === 'string' ? address.trim() : '';
    return { email, registration: !!email && state?.verificationSource === 'registration' };
  }
}
