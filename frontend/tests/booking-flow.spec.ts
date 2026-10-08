import '@angular/compiler';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { FormBuilder, Validators } from '@angular/forms';
import { BehaviorSubject, Subject, catchError, combineLatest, distinctUntilChanged, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import ts from 'typescript';
import type { BookingForm, BookingFormValue } from '../src/app/features/booking/models/booking-form.model.ts';
import type { BookingDraft, ProviderProfile, Service } from '../src/app/core/models/index.ts';
import { homeSizeRange } from '../src/app/features/booking/utils/booking-home-size.util.ts';
import { mergeAvailableSlots, providerIdsForSlot } from '../src/app/features/booking/utils/availability.util.ts';

// Execute the actual component methods with Angular forms and recording API stubs.
// No network requests or real reservations are made by this suite.
function sourceFile(path: string) {
  return ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
}
const model = sourceFile('../src/app/features/booking/models/booking-form.model.ts');
const functions = model.statements.filter(ts.isFunctionDeclaration).map((node) => node.getText(model).replace(/^export /u, ''));
const modelJs = ts.transpileModule(functions.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const { createBookingForm, configureBookingFormForService } = new Function('Validators', 'homeSizeRange', `${modelJs}; return { createBookingForm, configureBookingFormForService };`)(Validators, homeSizeRange) as {
  createBookingForm(builder: FormBuilder): BookingForm;
  configureBookingFormForService(form: BookingForm, service: Service): void;
};
const component = sourceFile('../src/app/features/booking/pages/booking-wizard/booking-wizard.component.ts');
const wizard = component.statements.find((node): node is ts.ClassDeclaration => ts.isClassDeclaration(node) && node.name?.text === 'BookingWizardComponent');
assert.ok(wizard);
const members = wizard.members.filter((node) => ts.isMethodDeclaration(node) || (ts.isPropertyDeclaration(node) && ['totalSteps', 'displayStep', 'progress'].includes(node.name.getText(component))));
const wizardJs = ts.transpileModule(`class FlowHarness { ${members.map((node) => node.getText(component)).join('\n')} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const Harness = new Function('computed', 'catchError', 'combineLatest', 'distinctUntilChanged', 'forkJoin', 'map', 'of', 'switchMap', 'takeUntilDestroyed', 'configureBookingFormForService', 'mergeAvailableSlots', 'providerIdsForSlot', `${wizardJs}; return FlowHarness;`)(
  (read: () => unknown) => read, catchError, combineLatest, distinctUntilChanged, forkJoin, map, of, switchMap,
  () => (source: unknown) => source, configureBookingFormForService, mergeAvailableSlots, providerIdsForSlot
);

function state<T>(initial: T) {
  let value = initial;
  return Object.assign(() => value, { set: (next: T) => { value = next; }, update: (change: (current: T) => T) => { value = change(value); } });
}
const service: Service = { id: 'clean-home', categoryId: 'cleaning', slug: 'limpeza-residencial', name: 'Home cleaning', description: '', symbol: 'LR', priceFromCents: 12000, unit: 'serviço', pricingType: 'fixed', durationMinutes: 240, minimumQuantity: 1, maximumQuantity: 5 };
const people = [{ id: 'ana', name: 'Ana' }, { id: 'juliana', name: 'Juliana' }] as ProviderProfile[];
type StoredDraft = { step: number; value: BookingFormValue };
interface FlowMethods {
  bindRoute(): void;
  applyPreferredProvider(id: string): boolean;
  dateChanged(): void;
  loadAvailability(advance: boolean): void;
  applyAvailableProviders(advance: boolean): void;
  restoreDraft(serviceId: string): void;
  selectedProvider(): ProviderProfile | undefined;
  buildDraft(): BookingDraft;
  next(): void;
  previous(): void;
  totalSteps(): number;
  displayStep(): number;
  progress(): number;
}

function fixture(preferred = '', stored: StoredDraft | null = null) {
  const form = createBookingForm(new FormBuilder());
  configureBookingFormForService(form, service);
  const availabilityCalls: string[] = [];
  const quotes: BookingDraft[] = [];
  const saved: StoredDraft[] = [];
  const slots = new Map([['ana', ['09:00']], ['juliana', ['10:00']]]);
  const failures = new Set<string>();
  const streams = new Map<string, Subject<{ slots: string[] }>>();
  const preferredParams = new BehaviorSubject({ get: () => preferred });
  const fields = {
    form, service: state<Service | null>(service), allProviders: state(people), providers: state(people), addresses: state([]),
    preferredProviderId: state(preferred), step: state(0), times: state<string[]>([]),
    availabilityLoading: state(false), availabilityError: state(''), availabilityRevision: 0,
    availabilityKey: '', availabilityByProvider: new Map<string, string[]>(),
    submitError: state(''), loadError: state(''), loading: state(false), quote: state(null), quoteLoading: state(false), confirmedBooking: state(null),
    bookingKey: '', destroyRef: {}, reload: new BehaviorSubject(0),
    route: { paramMap: of({ get: () => service.id }), queryParamMap: preferredParams },
    localization: { currency: () => 'EUR' },
    quoteRequests: { next: (request: { draft: BookingDraft }) => quotes.push(request.draft) },
    draftStorage: { load: () => stored, save: (_id: string, step: number, value: BookingFormValue) => saved.push({ step, value }) },
    marketplace: {
      service: () => of(service), providers: () => of(people), addresses: () => of([]), newIdempotencyKey: () => 'test-key',
      publicProviderAvailability: (id: string) => {
        availabilityCalls.push(id);
        return streams.get(id) ?? (failures.has(id) ? throwError(() => new Error('offline')) : of({ slots: slots.get(id) ?? [] }));
      }
    },
    focusHeading: () => undefined
  };
  const harness = Object.assign(new Harness(), fields) as typeof fields & FlowMethods;
  form.controls.providerId.setValue(preferred);
  form.controls.date.setValue('2026-10-09');
  return { harness, slots, failures, streams, availabilityCalls, quotes, saved, preferredParams };
}

describe('booking from a professional profile', () => {
  it('retains the chosen professional when changing the date and loads only their times', () => {
    const { harness, availabilityCalls } = fixture('ana');
    harness.form.controls.time.setValue('10:00');
    harness.dateChanged();
    assert.equal(harness.form.controls.providerId.value, 'ana');
    assert.equal(harness.form.controls.time.value, '');
    assert.deepEqual(availabilityCalls, ['ana']);
    assert.deepEqual(harness.times(), ['09:00']);
    assert.equal(harness.selectedProvider()?.name, 'Ana');
  });

  it('goes from address straight to review and goes back without a second provider choice', () => {
    const { harness, quotes, saved } = fixture('ana');
    harness.loadAvailability(false);
    harness.form.controls.time.setValue('09:00');
    harness.form.controls.address.patchValue({ postalCode: '01001-000', street: 'Test street', number: '1', neighborhood: 'Test' });
    harness.step.set(1);
    harness.next();
    assert.equal(harness.step(), 3);
    assert.equal(harness.displayStep(), 2);
    assert.equal(harness.totalSteps(), 3);
    assert.equal(harness.progress(), 100);
    assert.equal(quotes.at(-1)?.providerId, 'ana');
    assert.equal(saved.at(-1)?.step, 3);
    harness.previous();
    assert.equal(harness.step(), 1);
    assert.equal(harness.form.controls.providerId.value, 'ana');
  });

  it('does not silently replace an unavailable professional with another professional', () => {
    const { harness } = fixture('ana');
    harness.availabilityByProvider.set('ana', ['09:00']);
    harness.availabilityByProvider.set('juliana', ['10:00']);
    harness.form.controls.time.setValue('10:00');
    harness.step.set(1);
    harness.applyAvailableProviders(true);
    assert.equal(harness.step(), 0);
    assert.equal(harness.form.controls.providerId.value, 'ana');
    assert.ok(harness.submitError());
    assert.equal(harness.selectedProvider()?.name, 'Ana');
  });

  it('lets the explicit profile choice override a stale draft, including proposals', () => {
    for (const oldProvider of ['juliana', '__marketplace__']) {
      const old = fixture().harness.form.getRawValue();
      const { harness } = fixture('ana', { step: 3, value: { ...old, providerId: oldProvider, terms: true, homeSize: 125 } });
      harness.bindRoute();
      assert.equal(harness.preferredProviderId(), 'ana');
      assert.equal(harness.form.controls.providerId.value, 'ana');
      assert.equal(harness.form.controls.homeSize.value, 125);
      assert.equal(harness.form.controls.terms.value, false);
      assert.equal(harness.step(), 0);
    }
  });

  it('rejects an unknown/incompatible profile instead of suggesting a substitute', () => {
    const { harness, availabilityCalls } = fixture('missing');
    harness.bindRoute();
    assert.ok(harness.loadError());
    assert.equal(harness.loading(), false);
    assert.equal(harness.preferredProviderId(), '');
    assert.deepEqual(availabilityCalls, []);
  });

  it('keeps the profile when availability fails and does not advance', () => {
    const { harness, failures } = fixture('ana');
    failures.add('ana');
    harness.step.set(1);
    harness.loadAvailability(true);
    assert.equal(harness.step(), 1);
    assert.equal(harness.form.controls.providerId.value, 'ana');
    assert.ok(harness.availabilityError());
    assert.equal(harness.availabilityLoading(), false);
  });

  it('ignores old date responses when the date changes during a request', () => {
    const { harness, streams } = fixture('ana');
    const old = new Subject<{ slots: string[] }>();
    streams.set('ana', old);
    harness.loadAvailability(false);
    streams.delete('ana');
    harness.form.controls.date.setValue('2026-10-12');
    harness.dateChanged();
    old.next({ slots: ['18:00'] });
    old.complete();
    assert.deepEqual(harness.times(), ['09:00']);
    assert.equal(harness.form.controls.providerId.value, 'ana');
  });
});

describe('booking without an explicit profile', () => {
  it('keeps four steps and allows the provider selection / proposals flow', () => {
    const { harness, availabilityCalls } = fixture();
    harness.dateChanged();
    assert.deepEqual(availabilityCalls, ['ana', 'juliana']);
    assert.deepEqual(harness.times(), ['09:00', '10:00']);
    harness.form.controls.time.setValue('10:00');
    harness.applyAvailableProviders(true);
    assert.equal(harness.step(), 2);
    assert.equal(harness.totalSteps(), 4);
    assert.deepEqual(harness.providers().map((person) => person.id), ['juliana']);
    harness.form.controls.providerId.setValue('__marketplace__');
    harness.next();
    assert.equal(harness.step(), 3);
    assert.equal(harness.buildDraft().providerId, '');
    harness.previous();
    assert.equal(harness.step(), 2);
  });
});

describe('home size without changing service pricing', () => {
  it('offers a 20–400 m² slider for fixed/hourly cleaning, including production UUID categories', () => {
    for (const pricingType of ['fixed', 'hourly'] as const) {
      const cleaning = { ...service, categoryId: 'category-uuid', pricingType };
      assert.deepEqual(homeSizeRange(cleaning), { minimum: 20, maximum: 400 });
      const { harness } = fixture('ana');
      configureBookingFormForService(harness.form, cleaning);
      for (const [area, valid] of [[19, false], [20, true], [400, true], [401, false]] as const) {
        harness.form.controls.homeSize.setValue(area);
        assert.equal(harness.form.controls.homeSize.valid, valid);
      }
      assert.equal(cleaning.pricingType, pricingType);
      assert.equal(harness.form.controls.quantity.value, 1);
      harness.form.controls.homeSize.setValue(125);
      assert.equal(harness.buildDraft().homeSize, 125);
    }
  });

  it('uses server bounds for area pricing, including m² services without a pricingType', () => {
    for (const area of [{ ...service, pricingType: 'area' as const }, { ...service, pricingType: undefined, unit: 'm²' as const }]) {
      const { harness } = fixture();
      const bounded = { ...area, minimumQuantity: 50, maximumQuantity: 60 };
      configureBookingFormForService(harness.form, bounded);
      assert.deepEqual(homeSizeRange(bounded), { minimum: 50, maximum: 60 });
      assert.equal(harness.form.controls.homeSize.value, 60);
      assert.equal(harness.form.controls.quantity.value, 1);
      harness.form.controls.homeSize.setValue(61);
      assert.equal(harness.form.controls.homeSize.valid, false);
    }
  });

  it('does not show a home size slider for unrelated fixed/hourly services', () => {
    assert.equal(homeSizeRange({ ...service, categoryId: 'laundry', slug: 'lavagem-roupas' }), null);
    assert.equal(homeSizeRange({ ...service, categoryId: 'care', slug: 'cuidador-idosos', pricingType: 'hourly' }), null);
    assert.deepEqual(homeSizeRange({ ...service, pricingType: 'area', minimumQuantity: 100, maximumQuantity: 50 }), { minimum: 100, maximum: 100 });
  });
});
