import { SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { ProfessionalCourse, ProfessionalExperience, ProviderService, Service } from '../../../../core/models';
import { AccountIdentityComponent, AccountSecurityComponent, PageHeaderComponent, StatePanelComponent } from '../../../../shared/components';
import { LocalizationService } from '../../../../core/localization/localization.service';
import { displayReferenceAmount, displayReferenceBound, referenceAmountToCents } from '../../../../core/localization/reference-currency.util';
import { LocalizedMoneyPipe } from '../../../../shared/localization/localized-format.pipe';
import { coursePayload, experiencePayload } from '../../../../shared/utils/professional-record.util';

@Component({
  selector: 'cvp-provider-profile',
  standalone: true,
  imports: [AccountIdentityComponent, AccountSecurityComponent, LocalizedMoneyPipe, PageHeaderComponent, SlicePipe, StatePanelComponent],
  template: `
    <section class="portal-page provider-operations-page provider-profile-page">
      <cvp-page-header eyebrow="Sua vitrine" title="Perfil profissional" description="Apresente experiência, formação e serviços para conquistar novos clientes." />
      @if (success()) { <div class="alert alert-success" role="status">{{ success() }}</div> }
      @if (actionError()) { <div class="alert alert-error" role="alert">{{ actionError() }}</div> }
      @if (loading()) { <cvp-state-panel kind="loading" /> }
      @else if (loadError()) { <cvp-state-panel kind="error" title="Perfil indisponível" [message]="loadError()" (retry)="load()" /> }
      @else {
        <cvp-account-identity />
        <div class="settings-layout provider-settings-layout showcase-settings-layout">
          <section class="portal-card settings-form provider-settings-form">
            <div class="settings-section-heading"><div><span class="eyebrow">Vitrine pública</span><h2>Como clientes encontram você</h2></div><span class="profile-completeness">{{ profileCompleteness() }}% completo</span></div>
            <label>Título profissional<input #headline maxlength="160" [value]="field('headline')" placeholder="Ex.: Especialista em limpeza residencial"></label>
            <label>Sobre você<textarea #bio rows="4" maxlength="3000" [value]="field('bio')" placeholder="Conte como você trabalha, seus diferenciais e o que o cliente pode esperar."></textarea></label>
            <div class="form-grid provider-profile-fields expanded"><label>Anos de experiência<input #years type="number" min="0" max="60" [value]="numberField('yearsExperience', 0)"></label><label>Cidade-base<input #city [value]="field('baseCity')"></label><label>Estado<input #state maxlength="2" [value]="field('baseState')"></label><label>Raio (km)<input #radius type="number" min="1" max="300" [value]="numberField('serviceRadiusKm', 10)"></label></div>
            <button class="btn btn-primary btn-small profile-save-button" type="button" [disabled]="acting()" (click)="saveProfile(headline.value, bio.value, years.value, city.value, state.value, radius.value)">{{ acting() ? 'Salvando…' : 'Salvar vitrine' }}</button>
          </section>
          <aside class="portal-card verification-card provider-verification-card" [class.warning-card]="verificationStatus() === 'pending'"><span class="success-mark small">{{ verificationStatus() === 'approved' ? '✓' : '!' }}</span><div><h2>{{ verificationTitle() }}</h2><p>{{ verificationDescription() }}</p></div></aside>
        </div>

        <section class="portal-card professional-record-card">
          <div class="card-title-row"><div><span class="eyebrow">Credibilidade</span><h2>Experiência profissional</h2><p>Mostre trabalhos e funções relevantes. Estas informações aparecem no seu perfil público.</p></div></div>
          @if (experiences().length) { <div class="credential-list">@for (experience of experiences(); track experience.id) { <article><div><strong>{{ experience.role }}</strong><span>{{ experience.company }} · {{ experience.startedAt | slice:0:4 }}–{{ experience.current ? 'atual' : (experience.endedAt | slice:0:4) }}</span>@if (experience.description) { <p>{{ experience.description }}</p> }</div><div class="credential-actions"><details class="credential-edit"><summary>Editar</summary><div class="credential-edit-fields"><label>Função<input #editExperienceRole maxlength="120" [value]="experience.role"></label><label>Empresa ou atuação<input #editExperienceCompany maxlength="120" [value]="experience.company"></label><label>Data de início<input #editExperienceStart type="date" [value]="experience.startedAt"></label><label>Término <span class="optional">em branco = atual</span><input #editExperienceEnd type="date" [value]="experience.endedAt ?? ''"></label><label class="span-two">Descrição <span class="optional">opcional</span><textarea #editExperienceDescription rows="2" maxlength="1000" [value]="experience.description ?? ''"></textarea></label><button class="btn btn-secondary btn-small span-two" type="button" [disabled]="acting()" (click)="updateExperience(experience, editExperienceRole.value, editExperienceCompany.value, editExperienceStart.value, editExperienceEnd.value, editExperienceDescription.value)">Salvar alterações</button></div></details><button class="text-button" type="button" [disabled]="acting()" (click)="removeExperience(experience)">Remover</button></div></article> }</div> } @else { <p class="muted">Adicione sua primeira experiência para fortalecer a confiança no perfil.</p> }
          <div class="inline-action-form credential-form"><h3>Adicionar experiência</h3><div class="form-grid"><label>Função<input #experienceRole maxlength="120" placeholder="Ex.: Diarista e organizadora"></label><label>Empresa ou atuação<input #experienceCompany maxlength="120" placeholder="Autônoma, empresa ou projeto"></label><label>Data de início<input #experienceStart type="date"></label><label>Término <span class="optional">opcional</span><input #experienceEnd type="date"></label><label class="span-two">Descrição <span class="optional">opcional</span><textarea #experienceDescription rows="2" maxlength="1000" placeholder="Principais atividades e resultados."></textarea></label></div><div class="card-actions"><button class="btn btn-secondary btn-small" type="button" [disabled]="acting()" (click)="addExperience(experienceRole.value, experienceCompany.value, experienceStart.value, experienceEnd.value, experienceDescription.value)">Adicionar experiência</button></div></div>
        </section>

        <section class="portal-card professional-record-card">
          <div class="card-title-row"><div><span class="eyebrow">Formação</span><h2>Cursos e certificados</h2><p>Inclua cursos concluídos e links verificáveis de certificados quando houver.</p></div></div>
          @if (courses().length) { <div class="credential-list">@for (course of courses(); track course.id) { <article><div><strong>{{ course.title }}</strong><span>{{ course.institution }}@if (course.completedAt) { · {{ course.completedAt | slice:0:4 }} }</span>@if (course.certificateUrl) { <a [href]="course.certificateUrl" target="_blank" rel="noopener noreferrer">Ver certificado</a> }</div><div class="credential-actions"><details class="credential-edit"><summary>Editar</summary><div class="credential-edit-fields"><label>Curso ou certificado<input #editCourseTitle maxlength="160" [value]="course.title"></label><label>Instituição<input #editCourseInstitution maxlength="160" [value]="course.institution"></label><label>Conclusão <span class="optional">opcional</span><input #editCourseCompleted type="date" [value]="course.completedAt ?? ''"></label><label>Link do certificado <span class="optional">opcional</span><input #editCourseUrl type="url" maxlength="500" [value]="course.certificateUrl ?? ''"></label><button class="btn btn-secondary btn-small span-two" type="button" [disabled]="acting()" (click)="updateCourse(course, editCourseTitle.value, editCourseInstitution.value, editCourseCompleted.value, editCourseUrl.value)">Salvar alterações</button></div></details><button class="text-button" type="button" [disabled]="acting()" (click)="removeCourse(course)">Remover</button></div></article> }</div> } @else { <p class="muted">Ainda não há cursos cadastrados.</p> }
          <div class="inline-action-form credential-form"><h3>Adicionar curso</h3><div class="form-grid"><label>Curso ou certificado<input #courseTitle maxlength="160" placeholder="Ex.: NR-10 Segurança em instalações"></label><label>Instituição<input #courseInstitution maxlength="160" placeholder="Nome da instituição"></label><label>Conclusão <span class="optional">opcional</span><input #courseCompleted type="date"></label><label>Link do certificado <span class="optional">opcional</span><input #courseUrl type="url" maxlength="500" placeholder="https://"></label></div><div class="card-actions"><button class="btn btn-secondary btn-small" type="button" [disabled]="acting()" (click)="addCourse(courseTitle.value, courseInstitution.value, courseCompleted.value, courseUrl.value)">Adicionar curso</button></div></div>
        </section>

        <section class="portal-card settings-form provider-settings-form service-management-card"><div class="settings-section-heading"><div><span class="eyebrow">Catálogo</span><h2>Serviços oferecidos</h2></div><small>Defina preço e disponibilidade</small></div><div class="inline-action-form provider-add-service"><label>Novo serviço<select #newService><option value="">Selecione</option>@for (service of availableServices(); track service.id) { <option [value]="service.id">{{ service.name }}</option> }</select></label><label>Preço ({{ localization.currency() }})<input #newPrice type="number" [min]="minimumDisplayPrice()" [max]="maximumDisplayPrice()" step="0.01"></label><button class="btn btn-secondary btn-small" type="button" [disabled]="acting() || !newService.value" (click)="addService(newService.value, newPrice.value)">Adicionar serviço</button></div><div class="toggle-list provider-service-list">@for (service of services(); track service.id) { <div class="toggle-row provider-service-row"><span><strong>{{ service.name }}</strong><small>Catálogo: {{ service.catalogPriceCents / 100 | appMoney:'BRL' }}</small></span><label class="service-price-control"><span class="sr-only">Preço de {{ service.name }}</span><input #price type="number" [min]="minimumDisplayPrice()" [max]="maximumDisplayPrice()" step="0.01" [value]="displayPrice(service.customPriceCents)"></label><label class="service-toggle-control"><span class="sr-only">Ativar {{ service.name }}</span><input #active type="checkbox" [checked]="service.active"></label><div class="card-actions"><button class="btn btn-primary btn-small" type="button" [disabled]="acting()" (click)="updateService(service, price.value, active.checked)">Salvar</button><button class="text-button" type="button" [disabled]="acting()" (click)="removeService(service)">Remover</button></div></div> } @empty { <p class="muted">Adicione ao menos um serviço para enviar o perfil para análise.</p> }</div></section>
        <cvp-account-security />
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProviderProfileComponent implements OnInit {
  readonly localization = inject(LocalizationService);
  private readonly marketplace = inject(MarketplaceService);
  readonly services = signal<ProviderService[]>([]);
  readonly profile = signal<Record<string, unknown>>({});
  readonly catalog = signal<Service[]>([]);
  readonly experiences = signal<ProfessionalExperience[]>([]);
  readonly courses = signal<ProfessionalCourse[]>([]);
  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly loadError = signal('');
  readonly actionError = signal('');
  readonly success = signal('');

  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true); this.loadError.set('');
    forkJoin({ services: this.marketplace.providerServices(), profile: this.marketplace.providerProfile(), catalog: this.marketplace.services(), experiences: this.marketplace.providerExperiences(), courses: this.marketplace.providerCourses() }).subscribe({
      next: ({ services, profile, catalog, experiences, courses }) => { this.services.set(services); this.profile.set(profile); this.catalog.set(catalog); this.experiences.set(experiences); this.courses.set(courses); this.loading.set(false); },
      error: (failure: Error) => { this.loadError.set(failure.message); this.loading.set(false); }
    });
  }
  saveProfile(headline: string, bio: string, years: string, city: string, state: string, radius: string): void { this.perform(this.marketplace.updateProviderProfile({ headline: headline.trim(), bio: bio.trim(), yearsExperience: Number(years), baseCity: city.trim(), baseState: state.trim().toUpperCase(), serviceRadiusKm: Number(radius) }), (profile) => { this.profile.set(profile); this.success.set('Vitrine profissional atualizada.'); }); }
  addExperience(role: string, company: string, startedAt: string, endedAt: string, description: string): void { const result = experiencePayload(role, company, startedAt, endedAt, description); if (!result.ok) { this.actionError.set(result.error); return; } this.perform(this.marketplace.createProviderExperience(result.value), (experience) => { this.experiences.update((items) => [experience, ...items]); this.success.set('Experiência adicionada.'); }); }
  updateExperience(experience: ProfessionalExperience, role: string, company: string, startedAt: string, endedAt: string, description: string): void { const result = experiencePayload(role, company, startedAt, endedAt, description); if (!result.ok) { this.actionError.set(result.error); return; } this.perform(this.marketplace.updateProviderExperience(experience.id, result.value), (updated) => { this.experiences.update((items) => items.map((item) => item.id === updated.id ? updated : item)); this.success.set('Experiência atualizada.'); }); }
  removeExperience(experience: ProfessionalExperience): void { this.perform(this.marketplace.removeProviderExperience(experience.id), () => { this.experiences.update((items) => items.filter((item) => item.id !== experience.id)); this.success.set('Experiência removida.'); }); }
  addCourse(title: string, institution: string, completedAt: string, certificateUrl: string): void { const result = coursePayload(title, institution, completedAt, certificateUrl); if (!result.ok) { this.actionError.set(result.error); return; } this.perform(this.marketplace.createProviderCourse(result.value), (course) => { this.courses.update((items) => [course, ...items]); this.success.set('Curso adicionado.'); }); }
  updateCourse(course: ProfessionalCourse, title: string, institution: string, completedAt: string, certificateUrl: string): void { const result = coursePayload(title, institution, completedAt, certificateUrl); if (!result.ok) { this.actionError.set(result.error); return; } this.perform(this.marketplace.updateProviderCourse(course.id, result.value), (updated) => { this.courses.update((items) => items.map((item) => item.id === updated.id ? updated : item)); this.success.set('Curso atualizado.'); }); }
  removeCourse(course: ProfessionalCourse): void { this.perform(this.marketplace.removeProviderCourse(course.id), () => { this.courses.update((items) => items.filter((item) => item.id !== course.id)); this.success.set('Curso removido.'); }); }
  updateService(service: ProviderService, price: string, active: boolean): void {
    if (this.acting()) return;
    const priceCents = price.trim() && Number(price) === this.displayPrice(service.customPriceCents) ? service.customPriceCents : this.toBaseCents(price);
    if (!this.validPrice(priceCents)) { this.actionError.set(this.priceRangeError('Preço mínimo:')); return; }
    this.perform(this.marketplace.updateProviderService(service.id, { priceCents, active }), (updated) => { this.services.update((items) => items.map((item) => item.id === updated.id ? updated : item)); this.success.set('Serviço atualizado.'); });
  }
  addService(id: string, price: string): void {
    if (this.acting()) return;
    const catalog = this.catalog().find((service) => service.id === id);
    const priceCents = price.trim() ? this.toBaseCents(price) : (catalog?.priceFromCents ?? 0);
    if (!catalog || !this.validPrice(priceCents)) { this.actionError.set(this.priceRangeError('Selecione um serviço. Preço mínimo:')); return; }
    this.perform(this.marketplace.updateProviderService(id, { priceCents, active: true }), (updated) => { this.services.update((items) => [...items.filter((item) => item.id !== updated.id), updated].sort((a, b) => a.name.localeCompare(b.name))); this.success.set('Serviço adicionado.'); });
  }
  removeService(service: ProviderService): void { this.perform(this.marketplace.removeProviderService(service.id), () => { this.services.update((items) => items.filter((item) => item.id !== service.id)); this.success.set('Serviço removido.'); }); }
  availableServices(): Service[] { const ids = new Set(this.services().map((service) => service.id)); return this.catalog().filter((service) => !ids.has(service.id)); }
  verificationStatus(): string { return String(this.profile()['verificationStatus'] ?? 'pending'); }
  verificationTitle(): string { return ({ approved: 'Perfil aprovado', pending: 'Perfil em análise', rejected: 'Perfil rejeitado', suspended: 'Perfil suspenso' } as Record<string, string>)[this.verificationStatus()] ?? 'Perfil em análise'; }
  verificationDescription(): string { return this.verificationStatus() === 'approved' ? 'Habilitado para receber oportunidades na plataforma.' : this.verificationStatus() === 'pending' ? 'Complete serviços e agenda enquanto aguarda a análise.' : String(this.profile()['verificationNotes'] ?? 'Entre em contato com o suporte para revisar a situação.'); }
  field(name: string): string { const value = this.profile()[name]; return typeof value === 'string' ? value : ''; }
  numberField(name: string, fallback: number): number { const value = Number(this.profile()[name]); return Number.isFinite(value) ? value : fallback; }
  displayPrice(cents: number): number { return displayReferenceAmount(cents, 'BRL', this.localization.currency()); }
  minimumDisplayPrice(): number { return displayReferenceBound(1000, 'BRL', this.localization.currency(), 'minimum'); }
  maximumDisplayPrice(): number { return displayReferenceBound(10000000, 'BRL', this.localization.currency(), 'maximum'); }
  private validPrice(cents: number): boolean { return Number.isFinite(cents) && cents >= 1000 && cents <= 10000000; }
  private priceRangeError(label: string): string { return `${this.localization.translate(label)} ${this.localization.formatMoney(this.minimumDisplayPrice(), this.localization.currency())} · ${this.localization.translate('Preço máximo:')} ${this.localization.formatMoney(this.maximumDisplayPrice(), this.localization.currency())}`; }
  profileCompleteness(): number { const profile = this.profile(); const fields = ['headline', 'bio', 'baseCity']; const filled = fields.filter((field) => String(profile[field] ?? '').trim()).length + (this.services().length ? 1 : 0) + (this.experiences().length ? 1 : 0) + (this.courses().length ? 1 : 0); return Math.round(filled / 6 * 100); }
  private perform<T>(request: Observable<T>, next: (value: T) => void): void { if (this.acting()) return; this.acting.set(true); this.actionError.set(''); request.subscribe({ next: (value) => { next(value); this.acting.set(false); }, error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); } }); }
  private toBaseCents(value: string): number { return referenceAmountToCents(value, this.localization.currency(), 'BRL'); }
}
