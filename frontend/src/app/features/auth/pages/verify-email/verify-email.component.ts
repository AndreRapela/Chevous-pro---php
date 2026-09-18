import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthShellComponent } from '../../layout/auth-shell.component';

@Component({
  selector: 'cvp-verify-email', standalone: true, imports: [AuthShellComponent, RouterLink],
  template: `<cvp-auth-shell variant="recovery" eyebrow="Confirmação de cadastro" heroTitle="Confirme seu endereço de e-mail." heroDescription="A verificação protege sua conta e confirma que você controla o endereço informado." imageSrc="/images/eletricista-login-warm-640.jpg" imageSrcset="/images/eletricista-login-warm-640.jpg 640w, /images/eletricista-login-warm-1280.jpg 1280w" imageAlt="Eletricista residencial sorrindo com alicate e multímetro">@if (loading()) { <h2>Verificando e-mail…</h2><p class="muted" role="status">Aguarde um instante.</p> } @else if (error()) { <h2>Não foi possível verificar</h2><div class="alert alert-error" role="alert">{{ error() }}</div><a class="btn btn-secondary btn-block" routerLink="/entrar">Voltar para entrar</a> } @else { <div class="success-mark">✓</div><h2>E-mail verificado</h2><p>Sua conta está pronta para ser utilizada.</p><a class="btn btn-primary btn-block" routerLink="/entrar">Entrar</a> }</cvp-auth-shell>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VerifyEmailComponent implements OnInit {
  private readonly auth = inject(AuthService); private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';
  readonly loading = signal(true); readonly error = signal('');
  ngOnInit(): void { if (!this.token) { this.error.set('O link de verificação está incompleto.'); this.loading.set(false); return; } this.auth.verifyEmail(this.token).subscribe({ next: () => this.loading.set(false), error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); } }); }
}
