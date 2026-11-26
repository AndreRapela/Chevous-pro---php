import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { CountryCode } from 'libphonenumber-js/min';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/auth/auth.service';
import { LocalizationService } from '../../../../core/localization/localization.service';
import { ApiClientError } from '../../../../core/models';
import { DEFAULT_PHONE_COUNTRY, countryForPhone, internationalPhone, phoneCountryOptions, phoneFlagUrl, phoneWithCountry } from '../../registration-phone';
import { AuthShellComponent } from '../../layout/auth-shell.component';

type RegisterField = keyof RegisterComponent['form']['controls'];

@Component({
  selector: 'cvp-register',
  standalone: true,
  imports: [AuthShellComponent, ReactiveFormsModule, RouterLink],
  template: `
    <cvp-auth-shell
      variant="register"
      eyebrow="Comece agora"
      [heroTitle]="professionalMode() ? 'Transforme seu talento em oportunidades.' : 'Mais tempo para o que importa.'"
      [heroDescription]="professionalMode() ? 'Monte seu perfil, escolha sua região e organize sua agenda.' : 'Encontre pessoas de confiança para cuidar da sua rotina.'"
      imageSrc="/images/garconete-cadastro-v1-640.webp"
      imageSrcset="/images/garconete-cadastro-v1-640.webp 640w, /images/garconete-cadastro-v1-1086.webp 1086w"
      imageAlt="Garçonete profissional sorrindo com uma bandeja"
      [imageWidth]="1086"
      [imageHeight]="1448"
    >
      <a class="back-link" routerLink="/"><span aria-hidden="true">←</span> Voltar</a>
      <h2>Criar conta {{ professionalMode() ? 'profissional' : '' }}</h2>
      <p class="muted">Leva menos de dois minutos.</p>
      @if (error()) { <div class="alert alert-error" role="alert">{{ error() }}</div> }
      <form #registerForm [formGroup]="form" (ngSubmit)="submit(registerForm)" (focusin)="updateFocus($event.target)" (focusout)="leaveField($event)" novalidate>
        <label>Nome completo
          <input name="name" formControlName="name" autocomplete="name" [attr.aria-invalid]="invalid('name')" [attr.aria-describedby]="invalid('name') ? 'register-name-error' : null">
          @if (invalid('name')) { <small id="register-name-error" class="field-error">Informe seu nome completo.</small> }
        </label>
        <label>E-mail
          <input name="email" type="email" formControlName="email" autocomplete="email" inputmode="email" [attr.aria-invalid]="invalid('email')" [attr.aria-describedby]="invalid('email') ? 'register-email-error' : null">
          @if (invalid('email')) { <small id="register-email-error" class="field-error">Informe um e-mail válido.</small> }
        </label>
        <div class="register-phone">
          <label for="register-phone">Telefone</label>
          <div class="register-phone-field" data-register-field="phone">
            <div class="register-phone-country" [attr.title]="phoneCountryName()">
              @if (phoneCountry(); as country) {
                <img [src]="flagUrl(country)" alt="" width="22" height="16">
              } @else {
                <span aria-hidden="true">+</span>
              }
              <span class="country-chevron" aria-hidden="true"></span>
              <select [attr.aria-label]="localization.translate('País do telefone')" (change)="selectPhoneCountry($any($event.target).value)" data-cvp-no-localize>
                <option value="" [selected]="!phoneCountry()" disabled>{{ localization.translate('Selecione um país') }}</option>
                @for (option of countries(); track option.country) {
                  <option [value]="option.country" [selected]="option.country === phoneCountry()">{{ option.name }} (+{{ option.code }})</option>
                }
              </select>
            </div>
            <input id="register-phone" name="phone" type="tel" formControlName="phone" autocomplete="tel" inputmode="tel" maxlength="32" [attr.aria-invalid]="invalid('phone')" [attr.aria-describedby]="invalid('phone') ? 'register-phone-error' : null">
          </div>
          @if (invalid('phone')) { <small id="register-phone-error" class="field-error">Informe um telefone válido para o país selecionado.</small> }
        </div>
        <div class="register-password" data-register-field="password">
          <label for="register-password">Senha</label>
          <div class="password-input">
            <input id="register-password" name="password" [type]="passwordVisible() ? 'text' : 'password'" formControlName="password" autocomplete="new-password" [attr.aria-invalid]="invalid('password')" aria-describedby="register-password-rules">
            <button type="button" aria-controls="register-password" (click)="passwordVisible.set(!passwordVisible())" [attr.aria-label]="localization.translate(passwordVisible() ? 'Ocultar senha' : 'Mostrar senha')">{{ passwordVisible() ? 'Ocultar' : 'Mostrar' }}</button>
          </div>
          <small id="register-password-rules" [class.field-error]="invalid('password')">Use 8 caracteres, com maiúscula, minúscula, número e símbolo.</small>
        </div>
        @let confirmationInvalid = invalid('confirmation');
        <div class="register-password" data-register-field="confirmation">
          <label for="register-password-confirmation">Confirmar senha</label>
          <div class="password-input">
            <input id="register-password-confirmation" name="confirmation" [type]="confirmationVisible() ? 'text' : 'password'" formControlName="confirmation" autocomplete="new-password" aria-required="true" [attr.aria-invalid]="confirmationInvalid" [attr.aria-describedby]="confirmationInvalid ? 'register-password-confirmation-error' : null">
            <button type="button" aria-controls="register-password-confirmation" (click)="confirmationVisible.set(!confirmationVisible())" [attr.aria-label]="localization.translate(confirmationVisible() ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha')">{{ confirmationVisible() ? 'Ocultar' : 'Mostrar' }}</button>
          </div>
          @if (confirmationInvalid) {
            <small id="register-password-confirmation-error" class="field-error" role="alert">
              @if (form.controls.confirmation.hasError('required')) { Repita a senha. }
              @else { As senhas precisam ser iguais. }
            </small>
          }
        </div>
        <label class="check-row"><input name="terms" type="checkbox" formControlName="terms" [attr.aria-invalid]="invalid('terms')" [attr.aria-describedby]="invalid('terms') ? 'register-terms-error' : null"><span>Li e aceito os <a routerLink="/termos">Termos</a> e o <a routerLink="/privacidade">Aviso de privacidade</a>.</span></label>
        @if (invalid('terms')) { <small id="register-terms-error" class="field-error" role="alert">Aceite os termos e o aviso de privacidade para criar a conta.</small> }
        <button class="btn btn-primary btn-block" type="submit" [disabled]="auth.busy()">{{ auth.busy() ? 'Criando conta...' : 'Criar minha conta' }}</button>
      </form>
      <p class="auth-switch">Já tem conta? <a routerLink="/entrar">Entrar</a></p>
      <button class="text-button switch-mode" type="button" (click)="toggleMode()">{{ professionalMode() ? 'Quero contratar serviços' : 'Quero prestar serviços' }}</button>
    </cvp-auth-shell>
  `,
  styles: `
    .register-phone,
    .register-password { display: grid; gap: .32rem; }
    .register-password .password-input > input { padding-inline-end: 5.75rem; }
    .register-phone-field { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: .45rem; }
    .register-phone-field input { min-width: 0; }
    .register-phone-country {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: .45rem;
      min-width: 3.7rem;
      border: 1px solid var(--control-border);
      border-radius: .7rem;
      background: var(--control-background);
      color: var(--brand-800);
    }
    .register-phone-country img {
      display: block;
      object-fit: cover;
      border-radius: .15rem;
      box-shadow: 0 0 0 1px var(--ink-200);
    }
    .country-chevron {
      width: .38rem;
      height: .38rem;
      border-right: 1.5px solid currentColor;
      border-bottom: 1.5px solid currentColor;
      transform: translateY(-.1rem) rotate(45deg);
    }
    .register-phone-country select {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
    }
    .register-phone-country:focus-within { outline: 2px solid var(--control-focus); outline-offset: 2px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly validationFocus = signal<string | null>(null);
  private currentFocus: string | null = null;
  private pointerPressed = false;
  private clickFallback?: ReturnType<typeof setTimeout>;
  private preferredPhoneCountry = DEFAULT_PHONE_COUNTRY;
  readonly auth = inject(AuthService);
  readonly localization = inject(LocalizationService);
  readonly error = signal('');
  readonly professionalMode = signal(false);
  readonly passwordVisible = signal(false);
  readonly confirmationVisible = signal(false);
  readonly phoneCountry = signal<CountryCode | undefined>(DEFAULT_PHONE_COUNTRY);
  readonly flagUrl = phoneFlagUrl;
  readonly countries = computed(() => phoneCountryOptions(this.localization.locale()));
  readonly phoneCountryName = computed(() => this.countries().find((option) => option.country === this.phoneCountry())?.name
    ?? this.localization.translate('País do telefone'));
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [phoneWithCountry('', DEFAULT_PHONE_COUNTRY), [
      Validators.required,
      (control) => internationalPhone(control.value, this.preferredPhoneCountry) ? null : { phoneNumber: true }
    ]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)]],
    confirmation: ['', Validators.required],
    terms: [false, Validators.requiredTrue]
  }, {
    validators: (form) => {
      const { password, confirmation } = form.getRawValue();
      return password === confirmation ? null : { passwordMismatch: true };
    }
  });

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => clearTimeout(this.clickFallback));
    this.professionalMode.set(this.route.snapshot.queryParamMap.get('tipo') === 'profissional');
    this.form.controls.phone.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((phone) => {
      const country = countryForPhone(phone, this.preferredPhoneCountry);
      this.phoneCountry.set(country);
      if (country) this.preferredPhoneCountry = country;
    });
  }

  selectPhoneCountry(country: CountryCode): void {
    if (!country) return;
    this.preferredPhoneCountry = country;
    this.phoneCountry.set(country);
    const control = this.form.controls.phone;
    control.setValue(phoneWithCountry(control.value, country), { emitEvent: false });
  }

  updateFocus(target: EventTarget | null): void {
    this.currentFocus = this.fieldName(target);
    if (!this.pointerPressed) this.validationFocus.set(this.currentFocus);
  }

  @HostListener('document:pointerdown')
  deferValidationDuringClick(): void {
    clearTimeout(this.clickFallback);
    this.pointerPressed = true;
  }

  @HostListener('document:pointerup')
  scheduleValidationFallback(): void {
    if (!this.pointerPressed) return;
    // Touch focus can come after pointerup. Wait for click before moving any controls.
    clearTimeout(this.clickFallback);
    this.clickFallback = setTimeout(() => this.resumeValidationAfterClick(), 350);
  }

  @HostListener('document:click')
  @HostListener('document:pointercancel')
  @HostListener('window:blur')
  resumeValidationAfterClick(): void {
    clearTimeout(this.clickFallback);
    this.pointerPressed = false;
    this.validationFocus.set(this.currentFocus);
  }

  leaveField(event: FocusEvent): void {
    const field = this.fieldName(event.target);
    const next = this.fieldName(event.relatedTarget);
    if (field === 'phone' && next !== 'phone') this.form.controls.phone.markAsTouched();
    this.updateFocus(event.relatedTarget);
  }

  invalid(name: RegisterField): boolean {
    return this.validationFocus() !== name && this.form.controls[name].touched && this.hasValidationError(name);
  }

  private fieldName(target: EventTarget | null): string | null {
    if (!(target instanceof HTMLElement)) return null;
    return target.closest('[data-register-field]')?.getAttribute('data-register-field') ?? target.getAttribute('name');
  }

  private hasValidationError(name: RegisterField): boolean {
    return this.form.controls[name].invalid || (name === 'confirmation' && this.form.hasError('passwordMismatch'));
  }

  toggleMode(): void {
    this.professionalMode.update((value) => !value);
  }

  submit(registerForm: HTMLFormElement): void {
    if (this.auth.busy()) return;
    if (this.form.invalid) {
      const firstInvalid = (Object.keys(this.form.controls) as RegisterField[]).find((field) => this.hasValidationError(field));
      const input = firstInvalid && registerForm.elements.namedItem(firstInvalid);
      if (input instanceof HTMLElement) input.focus();
      return;
    }
    this.error.set('');
    const { name, email, phone: enteredPhone, password } = this.form.getRawValue();
    const phone = internationalPhone(enteredPhone, this.preferredPhoneCountry);
    if (!phone) return;
    this.auth.register({ name, email, phone, password }, this.professionalMode() ? 'provider' : 'customer')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ user, debugVerificationToken, debugVerificationCode }) => {
          this.form.reset();
          void this.router.navigate(['/verificar-email'], {
            state: { verificationEmail: user.email, verificationSource: 'registration' },
            info: environment.production ? undefined : { debugVerificationToken, debugVerificationCode }
          });
        },
        error: (failure: ApiClientError) => this.error.set(failure.message)
      });
  }
}
