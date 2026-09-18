import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { firstValueFrom, map, of, Subject } from 'rxjs';
import ts from 'typescript';
import { displayReferenceAmount, displayReferenceBound, referenceAmountToCents } from '../src/app/core/localization/reference-currency.util.ts';
import { normalizeProviderServicePrices } from '../src/app/shared/utils/provider-service.util.ts';
import type { ProviderService } from '../src/app/core/models/index.ts';

// Only repository-owned method bodies are compiled. API doubles never make network calls.
function compileMethods(path: string, names: string[], dependencies: Record<string, unknown>) {
  const source = ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  const methods: string[] = [];
  function inspect(node: ts.Node): void {
    if (ts.isMethodDeclaration(node) && names.includes(node.name.getText(source))) methods.push(node.getText(source));
    ts.forEachChild(node, inspect);
  }
  inspect(source);
  assert.equal(methods.length, names.length, 'All tested methods must exist in the actual component.');
  const output = ts.transpileModule(`class Harness { ${methods.join('\n')} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(dependencies), `${output}; return Harness;`)(...Object.values(dependencies));
}

const moneyDependencies = { displayReferenceAmount, displayReferenceBound, referenceAmountToCents };
const ProfileHarness = compileMethods('../src/app/features/provider/pages/profile/provider-profile.component.ts', ['updateService', 'addService', 'displayPrice', 'minimumDisplayPrice', 'maximumDisplayPrice', 'validPrice', 'priceRangeError', 'toBaseCents', 'perform'], moneyDependencies);
const service: ProviderService = { id: 'service-test', name: 'Home cleaning', slug: 'home-cleaning', pricingType: 'fixed', catalogPriceCents: 14400, customPriceCents: 10003, active: true };

function profileFixture(currency: 'EUR' | 'USD', pending = false) {
  const harness = new ProfileHarness();
  const calls: { id: string; priceCents: number; active: boolean }[] = [];
  let busy = false;
  let error = '';
  let services = [service];
  harness.acting = Object.assign(() => busy, { set: (value: boolean) => { busy = value; } });
  harness.actionError = { set: (value: string) => { error = value; } };
  harness.success = { set: () => undefined };
  harness.services = Object.assign(() => services, { update: (change: (items: ProviderService[]) => ProviderService[]) => { services = change(services); } });
  harness.catalog = () => [{ id: 'service-new', name: 'Laundry', priceFromCents: 14400 }];
  harness.localization = { currency: () => currency, translate: (text: string) => text, formatMoney: (amount: number) => `${currency} ${amount.toFixed(2)}` };
  harness.marketplace = { updateProviderService: (id: string, payload: { priceCents: number; active: boolean }) => {
    calls.push({ id, ...payload });
    return pending ? new Subject<ProviderService>() : of({ ...service, id, customPriceCents: payload.priceCents, active: payload.active });
  } };
  return { harness, calls, error: () => error, services: () => services };
}

class FormDataDouble {
  private readonly fields: Record<string, string>;
  constructor(form: { fields: Record<string, string> }) { this.fields = form.fields; }
  get(name: string): string | null { return this.fields[name] ?? null; }
}
const AdminHarness = compileMethods('../src/app/features/admin/pages/table/admin-table.component.ts', ['createService', 'toBaseCents', 'minimumDisplayPrice', 'maximumDisplayPrice'], { ...moneyDependencies, FormData: FormDataDouble });

function adminFixture(currency: 'EUR' | 'USD', price: string, valid = true, busy = false) {
  const harness = new AdminHarness();
  const calls: Record<string, unknown>[] = [];
  let error = '';
  let resets = 0;
  harness.acting = Object.assign(() => busy, { set: (value: boolean) => { busy = value; } });
  harness.actionError = { set: (value: string) => { error = value; } };
  harness.success = { set: () => undefined };
  harness.localization = { currency: () => currency };
  harness.load = () => undefined;
  harness.marketplace = { adminCreateService: (payload: Record<string, unknown>) => { calls.push(payload); return of({}); } };
  const form = { fields: { categoryId: 'category-test', name: '  Laundry  ', pricingType: 'fixed', price, duration: '120', description: '' }, reportValidity: () => valid, reset: () => { resets += 1; } };
  return { harness, calls, error: () => error, resets: () => resets, event: { preventDefault: () => undefined, currentTarget: form } };
}

describe('provider service price form contract', () => {
  it('preserves original cents when saving an untouched rounded price or toggling activity', () => {
    for (const [currency, displayed] of [['EUR', '17.01'], ['USD', '20.01']] as const) {
      const { harness, calls, services } = profileFixture(currency);
      harness.updateService(service, displayed, false);
      assert.deepEqual(calls, [{ id: service.id, priceCents: 10003, active: false }]);
      assert.equal(services()[0].customPriceCents, 10003);
      assert.equal(services()[0].active, false);
    }
  });
  it('converts edited amounts and applies the original catalog cents when no custom price is supplied', () => {
    for (const [currency, price] of [['EUR', '25.50'], ['USD', '30.00']] as const) {
      const edited = profileFixture(currency);
      edited.harness.updateService(service, price, true);
      assert.equal(edited.calls[0].priceCents, 15000);
      const created = profileFixture(currency);
      created.harness.addService('service-new', price);
      assert.equal(created.calls[0].priceCents, 15000);
      const catalog = profileFixture(currency);
      catalog.harness.addService('service-new', '   ');
      assert.equal(catalog.calls[0].priceCents, 14400);
    }
  });
  it('accepts both API price boundaries and rejects blank, invalid and out-of-range overrides', () => {
    for (const [currency, minimum, maximum] of [['EUR', 1.70, 17000], ['USD', 2.00, 20000]] as const) {
      assert.equal(profileFixture(currency).harness.minimumDisplayPrice(), minimum);
      assert.equal(profileFixture(currency).harness.maximumDisplayPrice(), maximum);
      for (const [amount, cents] of [[String(minimum), 1000], [String(maximum), 10000000]] as const) {
        const { harness, calls } = profileFixture(currency);
        harness.updateService(service, amount, true);
        assert.equal(calls[0].priceCents, cents);
      }
      for (const amount of ['', ' ', 'invalid', 'Infinity', '-1', '0', String(minimum - 0.01), String(maximum + 0.01)]) {
        const { harness, calls, error } = profileFixture(currency);
        harness.updateService(service, amount, true);
        assert.equal(calls.length, 0);
        assert.ok(error().includes(currency));
      }
      for (const amount of ['invalid', 'Infinity', String(minimum - 0.01), String(maximum + 0.01)]) {
        const { harness, calls, error } = profileFixture(currency);
        harness.addService('service-new', amount);
        assert.equal(calls.length, 0);
        assert.ok(error());
      }
    }
    const unknown = profileFixture('EUR');
    unknown.harness.addService('missing-service', '25.50');
    assert.equal(unknown.calls.length, 0);
    assert.ok(unknown.error());
  });
  it('prevents additional updates and additions while a save is pending', () => {
    const { harness, calls } = profileFixture('EUR', true);
    harness.updateService(service, '25.50', true);
    harness.updateService(service, '25.50', true);
    harness.addService('service-new', '25.50');
    assert.equal(calls.length, 1);
  });
});

describe('admin catalog price form contract', () => {
  it('uses the catalog API minimum, not the higher professional override minimum', () => {
    for (const [currency, minimum, maximum] of [['EUR', 0.17, 17000], ['USD', 0.20, 20000]] as const) {
      const fixture = adminFixture(currency, String(minimum));
      assert.equal(fixture.harness.minimumDisplayPrice(), minimum);
      assert.equal(fixture.harness.maximumDisplayPrice(), maximum);
      fixture.harness.createService(fixture.event);
      assert.equal(fixture.calls[0]['priceCents'], 100);
      assert.equal(fixture.calls[0]['name'], 'Laundry');
      assert.equal(fixture.resets(), 1);
      const boundary = adminFixture(currency, String(maximum));
      boundary.harness.createService(boundary.event);
      assert.equal(boundary.calls[0]['priceCents'], 10000000);
    }
  });
  it('converts an edited base price and blocks invalid cents even if native validity is bypassed', () => {
    for (const [currency, price] of [['EUR', '25.50'], ['USD', '30.00']] as const) {
      const valid = adminFixture(currency, price);
      valid.harness.createService(valid.event);
      assert.equal(valid.calls[0]['priceCents'], 15000);
    }
    for (const amount of ['', ' ', 'invalid', 'Infinity', '-1', '0.16', '17000.01']) {
      const fixture = adminFixture('EUR', amount);
      fixture.harness.createService(fixture.event);
      assert.equal(fixture.calls.length, 0);
      assert.equal(fixture.resets(), 0);
      assert.ok(fixture.error());
    }
    for (const [valid, busy] of [[false, false], [true, true]]) {
      const fixture = adminFixture('EUR', '25.50', valid, busy);
      fixture.harness.createService(fixture.event);
      assert.equal(fixture.calls.length, 0);
    }
    assert.ok(Number.isNaN(adminFixture('EUR', '').harness.toBaseCents(null)));
  });
});

describe('marketplace provider service response contract', () => {
  it('normalizes both list and update responses without replacing null prices with zero', async () => {
    const Harness = compileMethods('../src/app/core/data-access/marketplace.service.ts', ['providerServices', 'updateProviderService'], { map, normalizeProviderServicePrices });
    const harness = new Harness();
    const response = { ...service, catalogPriceCents: '14400', customPriceCents: null };
    harness.api = { get: () => of([response]), put: () => of(response) };
    const list = await firstValueFrom<ProviderService[]>(harness.providerServices());
    const updated = await firstValueFrom<ProviderService>(harness.updateProviderService(service.id, { priceCents: 14400, active: true }));
    assert.equal(list[0].customPriceCents, 14400);
    assert.equal(updated.customPriceCents, 14400);
    assert.equal(updated.catalogPriceCents, 14400);
  });
});
