import { SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import {
  ProfessionalCourse,
  ProfessionalExperience,
  ProviderService,
  Service
} from '../../../../core/models';
import {
  AccountIdentityComponent,
  AccountSecurityComponent,
  PageHeaderComponent,
  ServiceIconComponent,
  StatePanelComponent
} from '../../../../shared/components';
import { LocalizationService } from '../../../../core/localization/localization.service';
import {
  displayReferenceAmount,
  displayReferenceBound,
  referenceAmountToCents
} from '../../../../core/localization/reference-currency.util';
import { LocalizedMoneyPipe } from '../../../../shared/localization/localized-format.pipe';
import {
  coursePayload,
  experiencePayload
} from '../../../../shared/utils/professional-record.util';
import {
  cleanServiceName,
  CUSTOM_SERVICE_VALUE,
  serviceInitial,
  serviceNameExists
} from '../../../../shared/utils/service-name.util';

@Component({
  selector: 'cvp-provider-profile',
  standalone: true,
  imports: [
    AccountIdentityComponent,
    AccountSecurityComponent,
    LocalizedMoneyPipe,
    PageHeaderComponent,
    ServiceIconComponent,
    SlicePipe,
    StatePanelComponent
  ],
  templateUrl: './provider-profile.component.html',
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
  readonly customServiceValue = CUSTOM_SERVICE_VALUE;
  readonly selectedServiceId = signal('');
  readonly customServiceName = signal('');

  ngOnInit(): void {
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({
      services: this.marketplace.providerServices(),
      profile: this.marketplace.providerProfile(),
      catalog: this.marketplace.services(),
      experiences: this.marketplace.providerExperiences(),
      courses: this.marketplace.providerCourses()
    }).subscribe({
      next: ({ services, profile, catalog, experiences, courses }) => {
        this.services.set(services);
        this.profile.set(profile);
        this.catalog.set(catalog);
        this.experiences.set(experiences);
        this.courses.set(courses);
        this.loading.set(false);
      },
      error: (failure: Error) => {
        this.loadError.set(failure.message);
        this.loading.set(false);
      }
    });
  }
  saveProfile(
    headline: string,
    bio: string,
    years: string,
    city: string,
    state: string,
    radius: string
  ): void {
    this.perform(
      this.marketplace.updateProviderProfile({
        headline: headline.trim(),
        bio: bio.trim(),
        yearsExperience: Number(years),
        baseCity: city.trim(),
        baseState: state.trim().toUpperCase(),
        serviceRadiusKm: Number(radius)
      }),
      (profile) => {
        this.profile.set(profile);
        this.success.set('Vitrine profissional atualizada.');
      }
    );
  }
  addExperience(
    role: string,
    company: string,
    startedAt: string,
    endedAt: string,
    description: string
  ): void {
    const result = experiencePayload(role, company, startedAt, endedAt, description);
    if (!result.ok) {
      this.actionError.set(result.error);
      return;
    }
    this.perform(this.marketplace.createProviderExperience(result.value), (experience) => {
      this.experiences.update((items) => [experience, ...items]);
      this.success.set('Experiência adicionada.');
    });
  }
  updateExperience(
    experience: ProfessionalExperience,
    role: string,
    company: string,
    startedAt: string,
    endedAt: string,
    description: string
  ): void {
    const result = experiencePayload(role, company, startedAt, endedAt, description);
    if (!result.ok) {
      this.actionError.set(result.error);
      return;
    }
    this.perform(
      this.marketplace.updateProviderExperience(experience.id, result.value),
      (updated) => {
        this.experiences.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item))
        );
        this.success.set('Experiência atualizada.');
      }
    );
  }
  removeExperience(experience: ProfessionalExperience): void {
    this.perform(this.marketplace.removeProviderExperience(experience.id), () => {
      this.experiences.update((items) => items.filter((item) => item.id !== experience.id));
      this.success.set('Experiência removida.');
    });
  }
  addCourse(title: string, institution: string, completedAt: string, certificateUrl: string): void {
    const result = coursePayload(title, institution, completedAt, certificateUrl);
    if (!result.ok) {
      this.actionError.set(result.error);
      return;
    }
    this.perform(this.marketplace.createProviderCourse(result.value), (course) => {
      this.courses.update((items) => [course, ...items]);
      this.success.set('Curso adicionado.');
    });
  }
  updateCourse(
    course: ProfessionalCourse,
    title: string,
    institution: string,
    completedAt: string,
    certificateUrl: string
  ): void {
    const result = coursePayload(title, institution, completedAt, certificateUrl);
    if (!result.ok) {
      this.actionError.set(result.error);
      return;
    }
    this.perform(this.marketplace.updateProviderCourse(course.id, result.value), (updated) => {
      this.courses.update((items) =>
        items.map((item) => (item.id === updated.id ? updated : item))
      );
      this.success.set('Curso atualizado.');
    });
  }
  removeCourse(course: ProfessionalCourse): void {
    this.perform(this.marketplace.removeProviderCourse(course.id), () => {
      this.courses.update((items) => items.filter((item) => item.id !== course.id));
      this.success.set('Curso removido.');
    });
  }
  updateService(service: ProviderService, price: string, active: boolean): void {
    if (this.acting()) return;
    const priceCents =
      price.trim() && Number(price) === this.displayPrice(service.customPriceCents)
        ? service.customPriceCents
        : this.toBaseCents(price);
    if (!this.validPrice(priceCents)) {
      this.actionError.set(this.priceRangeError('Preço mínimo:'));
      return;
    }
    this.perform(
      this.marketplace.updateProviderService(service.id, { priceCents, active }),
      (updated) => {
        this.services.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item))
        );
        this.success.set('Serviço atualizado.');
      }
    );
  }
  addService(id: string, price: string): void {
    if (this.acting()) return;
    const catalog = this.catalog().find((service) => service.id === id);
    const priceCents = price.trim() ? this.toBaseCents(price) : (catalog?.priceFromCents ?? 0);
    if (!catalog || !this.validPrice(priceCents)) {
      this.actionError.set(this.priceRangeError('Selecione um serviço. Preço mínimo:'));
      return;
    }
    this.perform(
      this.marketplace.updateProviderService(id, { priceCents, active: true }),
      (updated) => {
        this.services.update((items) =>
          [...items.filter((item) => item.id !== updated.id), updated].sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        );
        this.selectedServiceId?.set('');
        this.customServiceName?.set('');
        this.success.set('Serviço adicionado.');
      }
    );
  }
  selectService(id: string): void {
    this.selectedServiceId.set(id);
    if (id !== this.customServiceValue) this.customServiceName.set('');
  }
  customServiceMode(): boolean {
    return this.selectedServiceId() === this.customServiceValue;
  }
  customServiceNameExists(): boolean {
    return serviceNameExists(this.customServiceName(), [...this.catalog(), ...this.services()]);
  }
  canAddSelectedService(): boolean {
    const id = this.selectedServiceId();
    if (id === this.customServiceValue)
      return (
        cleanServiceName(this.customServiceName()).length >= 2 && !this.customServiceNameExists()
      );
    return Boolean(id) && !this.hasService(id);
  }
  addSelectedService(price: string): void {
    if (this.customServiceMode()) {
      this.addCustomService(price);
      return;
    }
    this.addService(this.selectedServiceId(), price);
  }
  addCustomService(price: string): void {
    if (this.acting()) return;
    const name = cleanServiceName(this.customServiceName());
    const priceCents = this.toBaseCents(price);
    if (name.length < 2) {
      this.actionError.set('Informe um nome com pelo menos 2 caracteres.');
      return;
    }
    if (this.customServiceNameExists()) {
      this.actionError.set('Esse nome já existe. Selecione o serviço correspondente na lista.');
      return;
    }
    if (!this.validPrice(priceCents)) {
      this.actionError.set(this.priceRangeError('Preço mínimo:'));
      return;
    }
    this.perform(this.marketplace.createCustomProviderService({ name, priceCents }), (created) => {
      this.services.update((items) =>
        [...items, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      this.resetServiceDraft();
      this.success.set('Serviço personalizado adicionado.');
    });
  }
  removeService(service: ProviderService): void {
    this.perform(this.marketplace.removeProviderService(service.id), () => {
      this.services.update((items) => items.filter((item) => item.id !== service.id));
      this.success.set('Serviço removido.');
    });
  }
  availableServices(): Service[] {
    const ids = new Set(this.services().map((service) => service.id));
    return this.catalog().filter((service) => !ids.has(service.id));
  }
  hasService(id: string): boolean {
    return this.services().some((service) => service.id === id);
  }
  serviceInitial(name: string): string {
    return serviceInitial(name);
  }
  verificationStatus(): string {
    return String(this.profile()['verificationStatus'] ?? 'pending');
  }
  verificationTitle(): string {
    return (
      (
        {
          approved: 'Perfil aprovado',
          pending: 'Perfil em análise',
          rejected: 'Perfil rejeitado',
          suspended: 'Perfil suspenso'
        } as Record<string, string>
      )[this.verificationStatus()] ?? 'Perfil em análise'
    );
  }
  verificationDescription(): string {
    return this.verificationStatus() === 'approved'
      ? 'Habilitado para receber oportunidades na plataforma.'
      : this.verificationStatus() === 'pending'
        ? 'Complete serviços e agenda enquanto aguarda a análise.'
        : String(
            this.profile()['verificationNotes'] ??
              'Entre em contato com o suporte para revisar a situação.'
          );
  }
  field(name: string): string {
    const value = this.profile()[name];
    return typeof value === 'string' ? value : '';
  }
  numberField(name: string, fallback: number): number {
    const value = Number(this.profile()[name]);
    return Number.isFinite(value) ? value : fallback;
  }
  displayPrice(cents: number): number {
    return displayReferenceAmount(cents, 'BRL', this.localization.currency());
  }
  minimumDisplayPrice(): number {
    return displayReferenceBound(1000, 'BRL', this.localization.currency(), 'minimum');
  }
  maximumDisplayPrice(): number {
    return displayReferenceBound(10000000, 'BRL', this.localization.currency(), 'maximum');
  }
  private validPrice(cents: number): boolean {
    return Number.isFinite(cents) && cents >= 1000 && cents <= 10000000;
  }
  private priceRangeError(label: string): string {
    return `${this.localization.translate(label)} ${this.localization.formatMoney(this.minimumDisplayPrice(), this.localization.currency())} · ${this.localization.translate('Preço máximo:')} ${this.localization.formatMoney(this.maximumDisplayPrice(), this.localization.currency())}`;
  }
  profileCompleteness(): number {
    const profile = this.profile();
    const fields = ['headline', 'bio', 'baseCity'];
    const filled =
      fields.filter((field) => String(profile[field] ?? '').trim()).length +
      (this.services().length ? 1 : 0) +
      (this.experiences().length ? 1 : 0) +
      (this.courses().length ? 1 : 0);
    return Math.round((filled / 6) * 100);
  }
  private perform<T>(request: Observable<T>, next: (value: T) => void): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.actionError.set('');
    request.subscribe({
      next: (value) => {
        next(value);
        this.acting.set(false);
      },
      error: (failure: Error) => {
        this.actionError.set(failure.message);
        this.acting.set(false);
      }
    });
  }
  private toBaseCents(value: string): number {
    return referenceAmountToCents(value, this.localization.currency(), 'BRL');
  }
  private resetServiceDraft(): void {
    this.selectedServiceId.set('');
    this.customServiceName.set('');
  }
}
