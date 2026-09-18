import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { LocalizationService } from '../../../../core/localization/localization.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Address } from '../../../../core/models';
import { AccountIdentityComponent, AccountSecurityComponent, PageHeaderComponent } from '../../../../shared/components';

@Component({
  selector: 'cvp-customer-profile',
  standalone: true,
  imports: [AccountIdentityComponent, AccountSecurityComponent, PageHeaderComponent, ReactiveFormsModule],
  template: `
    <section class="portal-page customer-profile-page">
      <cvp-page-header eyebrow="Sua conta" title="Perfil e preferências" description="Mantenha seus dados atualizados." />
      @if (saved()) { <div class="alert alert-success" role="status">Alterações salvas com sucesso.</div> }
      @if (error()) { <div class="alert alert-error" role="alert">{{ error() }}</div> }
      <div class="settings-layout">
        <cvp-account-identity />
        <aside class="portal-card settings-nav"><span class="success-mark small">✓</span><h2>Conta protegida</h2><p>O acesso usa sessão renovável em cookie protegido. Revise abaixo os dispositivos conectados e mantenha sua senha atualizada.</p></aside>
      </div>
      <cvp-account-security />
      <section class="portal-card address-settings"><div class="card-title-row"><div><span class="eyebrow">Locais de atendimento</span><h2>Endereços salvos</h2></div><button class="btn btn-secondary btn-small" type="button" (click)="resetAddressForm()">Novo endereço</button></div>
        @if (addressesLoading()) { <p class="muted" role="status">Carregando endereços…</p> }
        @else { @if (addresses().length) { <div class="address-list">@for (address of addresses(); track address.id) { <article><div><strong><span data-cvp-no-localize>{{ address.label || localization.translate('Endereço') }}</span> @if (address.isDefault) { <span class="chip chip-soft">Principal</span> }</strong><p data-cvp-no-localize>{{ address.street }}, {{ address.number }} · {{ address.neighborhood }}, {{ address.city }}/{{ address.state }}</p></div><div class="card-actions"><button class="text-button" type="button" (click)="editAddress(address)">Editar</button>@if (removeTarget() === address.id) { <button class="btn btn-secondary btn-small" type="button" (click)="removeTarget.set('')">Voltar</button><button class="btn btn-danger btn-small" type="button" [disabled]="addressSaving()" (click)="removeAddress(address)">Confirmar remoção</button> } @else { <button class="text-button" type="button" (click)="removeTarget.set(address.id || '')">Remover</button> }</div></article> }</div> } @else { <p class="muted">Nenhum endereço salvo.</p> } }
        <form class="inline-action-form" [formGroup]="addressForm" (ngSubmit)="saveAddress()" novalidate><h3>{{ editingAddressId() ? 'Editar endereço' : 'Adicionar endereço' }}</h3><div class="form-grid"><label>Identificação<input formControlName="label" placeholder="Casa ou trabalho"></label><label>CEP<input formControlName="postalCode" autocomplete="postal-code" inputmode="numeric"></label><label class="span-two">Rua<input formControlName="street" autocomplete="address-line1"></label><label>Número<input formControlName="number"></label><label>Complemento <span class="optional">Opcional</span><input formControlName="complement"></label><label>Bairro<input formControlName="neighborhood"></label><label>Cidade<input formControlName="city" autocomplete="address-level2"></label><label>Estado<input formControlName="state" autocomplete="address-level1" maxlength="2"></label><label class="check-row"><input type="checkbox" formControlName="isDefault"><span>Usar como endereço principal</span></label></div><div class="card-actions"><button class="btn btn-primary" type="submit" [disabled]="addressSaving()">{{ addressSaving() ? 'Salvando…' : editingAddressId() ? 'Atualizar endereço' : 'Adicionar endereço' }}</button></div></form>
      </section>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomerProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly marketplace = inject(MarketplaceService);
  readonly localization = inject(LocalizationService);
  readonly saved = signal(false);
  readonly error = signal('');
  readonly addresses = signal<Address[]>([]);
  readonly addressesLoading = signal(true);
  readonly addressSaving = signal(false);
  readonly editingAddressId = signal('');
  readonly removeTarget = signal('');
  readonly addressForm = this.fb.nonNullable.group({
    label: [this.localization.translate('Casa'), [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    postalCode: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(9)]],
    street: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(180)]],
    number: ['', [Validators.required, Validators.maxLength(20)]],
    complement: ['', Validators.maxLength(100)],
    neighborhood: ['', [Validators.required, Validators.maxLength(100)]],
    city: [this.auth.user()?.city || 'São Paulo', [Validators.required, Validators.maxLength(100)]],
    state: ['SP', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
    isDefault: [false]
  });

  ngOnInit(): void { this.loadAddresses(); }

  loadAddresses(): void {
    this.addressesLoading.set(true);
    this.marketplace.addresses().subscribe({ next: (addresses) => { this.addresses.set(addresses); this.addressesLoading.set(false); }, error: (failure: Error) => { this.error.set(failure.message); this.addressesLoading.set(false); } });
  }

  editAddress(address: Address): void {
    this.editingAddressId.set(address.id || '');
    this.addressForm.reset({ label: address.label || this.localization.translate('Casa'), postalCode: address.postalCode, street: address.street, number: address.number, complement: address.complement || '', neighborhood: address.neighborhood, city: address.city, state: address.state, isDefault: !!address.isDefault });
  }

  resetAddressForm(): void {
    this.editingAddressId.set(''); this.removeTarget.set('');
    this.addressForm.reset({ label: this.localization.translate('Casa'), postalCode: '', street: '', number: '', complement: '', neighborhood: '', city: this.auth.user()?.city || 'São Paulo', state: 'SP', isDefault: false });
  }

  saveAddress(): void {
    this.addressForm.markAllAsTouched(); if (this.addressForm.invalid || this.addressSaving()) return;
    const raw = this.addressForm.getRawValue(); const payload: Address = { ...raw, label: raw.label.trim(), postalCode: raw.postalCode.trim(), street: raw.street.trim(), number: raw.number.trim(), complement: raw.complement.trim() || undefined, neighborhood: raw.neighborhood.trim(), city: raw.city.trim(), state: raw.state.trim().toUpperCase() };
    const request = this.editingAddressId() ? this.marketplace.updateAddress(this.editingAddressId(), payload) : this.marketplace.createAddress(payload);
    this.addressSaving.set(true); this.error.set('');
    request.subscribe({ next: (address) => { this.addresses.update((items) => { const updated = raw.isDefault ? items.map((item) => ({ ...item, isDefault: false })) : items; return this.editingAddressId() ? updated.map((item) => item.id === address.id ? address : item) : [address, ...updated]; }); this.saved.set(true); this.addressSaving.set(false); this.resetAddressForm(); }, error: (failure: Error) => { this.error.set(failure.message); this.addressSaving.set(false); } });
  }

  removeAddress(address: Address): void {
    if (!address.id || this.addressSaving()) return; this.addressSaving.set(true); this.error.set('');
    this.marketplace.removeAddress(address.id).subscribe({ next: () => { this.addresses.update((items) => items.filter((item) => item.id !== address.id)); this.removeTarget.set(''); this.addressSaving.set(false); }, error: (failure: Error) => { this.error.set(failure.message); this.addressSaving.set(false); } });
  }
}
