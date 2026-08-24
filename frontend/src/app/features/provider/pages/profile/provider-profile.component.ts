import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { ProviderService, Service } from '../../../../core/models';
import { PageHeaderComponent, StatePanelComponent } from '../../../../shared/components';

@Component({
  selector: 'cvp-provider-profile',
  standalone: true,
  imports: [CurrencyPipe, PageHeaderComponent, StatePanelComponent],
  template: `
    <section class="portal-page provider-operations-page provider-profile-page">
      <cvp-page-header eyebrow="Sua vitrine" title="Serviços e perfil" description="Atualize sua apresentação e os serviços oferecidos." />
      @if (success()) { <div class="alert alert-success" role="status">{{ success() }}</div> }
      @if (actionError()) { <div class="alert alert-error" role="alert">{{ actionError() }}</div> }
      @if (loading()) { <cvp-state-panel kind="loading" /> }
      @else if (loadError()) { <cvp-state-panel kind="error" title="Perfil indisponível" [message]="loadError()" (retry)="load()" /> }
      @else {
        <div class="settings-layout provider-settings-layout"><section class="portal-card settings-form provider-settings-form"><h2>Apresentação</h2><label>Título profissional<input #headline [value]="field('headline')"></label><label>Sobre você<textarea #bio rows="3" [value]="field('bio')"></textarea></label><div class="form-grid provider-profile-fields"><label>Cidade<input #city [value]="field('baseCity')"></label><label>Estado<input #state maxlength="2" [value]="field('baseState')"></label><label>Raio (km)<input #radius type="number" min="1" max="200" [value]="numberField('serviceRadiusKm', 10)"></label></div><button class="btn btn-primary btn-small profile-save-button" type="button" [disabled]="acting()" (click)="saveProfile(headline.value, bio.value, city.value, state.value, radius.value)">Salvar perfil</button><div class="settings-section-heading"><h2>Serviços oferecidos</h2><small>Defina preço e disponibilidade</small></div><div class="inline-action-form provider-add-service"><label>Novo serviço<select #newService><option value="">Selecione</option>@for (service of availableServices(); track service.id) { <option [value]="service.id">{{ service.name }}</option> }</select></label><label>Preço (R$)<input #newPrice type="number" min="10" step="0.01"></label><button class="btn btn-secondary btn-small" type="button" [disabled]="acting() || !newService.value" (click)="addService(newService.value, newPrice.value)">Adicionar serviço</button></div><div class="toggle-list provider-service-list">@for (service of services(); track service.id) { <div class="toggle-row provider-service-row"><span><strong>{{ service.name }}</strong><small>Catálogo: {{ service.catalogPriceCents / 100 | currency:'BRL':'symbol':'1.2-2':'pt-BR' }}</small></span><label class="service-price-control"><span class="sr-only">Preço de {{ service.name }}</span><input #price type="number" min="10" step="0.01" [value]="service.customPriceCents / 100"></label><label class="service-toggle-control"><span class="sr-only">Ativar {{ service.name }}</span><input #active type="checkbox" [checked]="service.active"></label><div class="card-actions"><button class="btn btn-primary btn-small" type="button" [disabled]="acting()" (click)="updateService(service, price.value, active.checked)">Salvar</button><button class="text-button" type="button" [disabled]="acting()" (click)="removeService(service)">Remover</button></div></div> } @empty { <p class="muted">Adicione ao menos um serviço para enviar o perfil para análise.</p> }</div></section><aside class="portal-card verification-card provider-verification-card" [class.warning-card]="verificationStatus() === 'pending'"><span class="success-mark small">{{ verificationStatus() === 'approved' ? '✓' : '!' }}</span><div><h2>{{ verificationTitle() }}</h2><p>{{ verificationDescription() }}</p></div></aside></div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProviderProfileComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  readonly services = signal<ProviderService[]>([]);
  readonly profile = signal<Record<string, unknown>>({});
  readonly catalog = signal<Service[]>([]);
  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly loadError = signal('');
  readonly actionError = signal('');
  readonly success = signal('');

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({ services: this.marketplace.providerServices(), profile: this.marketplace.providerProfile(), catalog: this.marketplace.services() }).subscribe({
      next: ({ services, profile, catalog }) => { this.services.set(services); this.profile.set(profile); this.catalog.set(catalog); this.loading.set(false); },
      error: (failure: Error) => { this.loadError.set(failure.message); this.loading.set(false); }
    });
  }

  saveProfile(headline: string, bio: string, city: string, state: string, radius: string): void {
    this.acting.set(true);
    this.actionError.set('');
    this.marketplace.updateProviderProfile({ headline: headline.trim(), bio: bio.trim(), baseCity: city.trim(), baseState: state.trim().toUpperCase(), serviceRadiusKm: Number(radius) }).subscribe({
      next: (profile) => { this.profile.set(profile); this.success.set('Perfil atualizado.'); this.acting.set(false); },
      error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); }
    });
  }

  updateService(service: ProviderService, price: string, active: boolean): void {
    const priceCents = Math.round(Number(price) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 1000) {
      this.actionError.set('O preço mínimo é R$ 10,00.');
      return;
    }
    this.acting.set(true);
    this.actionError.set('');
    this.marketplace.updateProviderService(service.id, { priceCents, active }).subscribe({
      next: (updated) => { this.services.update((items) => items.map((item) => item.id === updated.id ? updated : item)); this.success.set('Serviço atualizado.'); this.acting.set(false); },
      error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); }
    });
  }

  addService(id: string, price: string): void {
    const catalog = this.catalog().find((service) => service.id === id);
    const priceCents = Math.round(Number(price || (catalog?.priceFromCents ?? 0) / 100) * 100);
    if (!catalog || !Number.isFinite(priceCents) || priceCents < 1000) { this.actionError.set('Selecione um serviço e informe um preço mínimo de R$ 10,00.'); return; }
    this.acting.set(true); this.actionError.set('');
    this.marketplace.updateProviderService(id, { priceCents, active: true }).subscribe({
      next: (updated) => { this.services.update((items) => [...items.filter((item) => item.id !== updated.id), updated].sort((a, b) => a.name.localeCompare(b.name))); this.success.set('Serviço adicionado.'); this.acting.set(false); },
      error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); }
    });
  }

  removeService(service: ProviderService): void {
    this.acting.set(true); this.actionError.set('');
    this.marketplace.removeProviderService(service.id).subscribe({
      next: () => { this.services.update((items) => items.filter((item) => item.id !== service.id)); this.success.set('Serviço removido.'); this.acting.set(false); },
      error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); }
    });
  }

  availableServices(): Service[] { const ids = new Set(this.services().map((service) => service.id)); return this.catalog().filter((service) => !ids.has(service.id)); }
  verificationStatus(): string { return String(this.profile()['verificationStatus'] ?? 'pending'); }
  verificationTitle(): string { return ({ approved: 'Perfil aprovado', pending: 'Perfil em análise', rejected: 'Perfil rejeitado', suspended: 'Perfil suspenso' } as Record<string, string>)[this.verificationStatus()] ?? 'Perfil em análise'; }
  verificationDescription(): string { return this.verificationStatus() === 'approved' ? 'Habilitado para receber oportunidades na plataforma.' : this.verificationStatus() === 'pending' ? 'Complete serviços e agenda enquanto aguarda a análise.' : String(this.profile()['verificationNotes'] ?? 'Entre em contato com o suporte para revisar a situação.'); }

  field(name: string): string {
    const value = this.profile()[name];
    return typeof value === 'string' ? value : '';
  }

  numberField(name: string, fallback: number): number {
    const value = Number(this.profile()[name]);
    return Number.isFinite(value) ? value : fallback;
  }
}
