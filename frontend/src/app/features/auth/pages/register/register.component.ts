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
  template: `
    <cvp-auth-shell
      variant="register"
      eyebrow="Comece agora"
      [heroTitle]="professionalMode() ? 'Transforme seu talento em oportunidades.' : 'Mais tempo para o que importa.'"
      [heroDescription]="professionalMode() ? 'Monte seu perfil, escolha sua região e organize sua agenda.' : 'Encontre pessoas de confiança para cuidar da sua rotina.'"
      imageSrc="/images/garconete-cadastro-warm-640.jpg"
      imageSrcset="/images/garconete-cadastro-warm-640.jpg 640w, /images/garconete-cadastro-warm-1086.jpg 1086w"
      imageAlt="Garçonete profissional sorrindo com uma bandeja"
      [imageWidth]="1086"
      [imageHeight]="1448"
    >
      <a class="back-link" routerLink="/"><span aria-hidden="true">←</span> Voltar</a>
      <h2>Criar conta {{ professionalMode() ? 'profissional' : '' }}</h2>
      <p class="muted">Leva menos de dois minutos.</p>
      @if (error()) { <div class="alert alert-error" role="alert">{{ error() }}</div> }
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label>Nome completo<input formControlName="name" autocomplete="name" [attr.aria-invalid]="invalid('name')">@if (invalid('name')) { <small class="field-error">Informe seu nome completo.</small> }</label>
        <label>E-mail<input type="email" formControlName="email" autocomplete="email" inputmode="email" [attr.aria-invalid]="invalid('email')">@if (invalid('email')) { <small class="field-error">Informe um e-mail válido.</small> }</label>
        <label>Celular<input type="tel" formControlName="phone" autocomplete="tel" inputmode="tel" placeholder="(11) 99999-9999" [attr.aria-invalid]="invalid('phone')">@if (invalid('phone')) { <small class="field-error">Informe um celular válido.</small> }</label>
        <label>Senha<input type="password" formControlName="password" autocomplete="new-password" [attr.aria-invalid]="invalid('password')"><small [class.field-error]="invalid('password')">Use 8 caracteres, com maiúscula, minúscula, número e símbolo.</small></label>
        <label class="check-row"><input type="checkbox" formControlName="terms"><span>Li e aceito os <a routerLink="/termos">Termos</a> e o <a routerLink="/privacidade">Aviso de privacidade</a>.</span></label>
        <button class="btn btn-primary btn-block" type="submit" [disabled]="auth.busy()">{{ auth.busy() ? 'Criando conta...' : 'Criar minha conta' }}</button>
      </form>
      <p class="auth-switch">Já tem conta? <a routerLink="/entrar">Entrar</a></p>
      <button class="text-button switch-mode" type="button" (click)="toggleMode()">{{ professionalMode() ? 'Quero contratar serviços' : 'Quero prestar serviços' }}</button>
    </cvp-auth-shell>
  `,
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
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)]],
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
    this.auth.register({ name, email, phone, password }, this.professionalMode() ? 'provider' : 'customer').subscribe({
      next: () => void this.router.navigate(['/entrar'], { queryParams: { cadastro: 'sucesso' } }),
      error: (failure: ApiClientError) => this.error.set(failure.message)
    });
  }
}
