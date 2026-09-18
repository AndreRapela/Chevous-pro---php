import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import ts from 'typescript';
import { convertReferenceAmount, displayReferenceAmount, referenceAmountToCents } from '../src/app/core/localization/reference-currency.util.ts';
import type { ReferenceCurrency } from '../src/app/core/localization/reference-currency.util.ts';

type RequestReference = { id: string; suggestedSubtotalCents: number; currency: ReferenceCurrency };
type OfferCall = { id: string; cents: number; message: string };
interface RequestHarness {
  marketplace: unknown;
  localization: unknown;
  acting: unknown;
  actionError: unknown;
  offer(request: RequestReference, amount: string, message: string): void;
  displayAmount(request: RequestReference): number;
  minimumAmount(request: RequestReference): number;
  maximumAmount(request: RequestReference): number;
}

// Run the component's actual form methods with a recording API stub, never a network client.
const component = ts.createSourceFile('requests.ts', readFileSync(new URL('../src/app/features/provider/pages/requests/provider-requests.component.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
const methods: string[] = [];
function inspect(node: ts.Node): void {
  if (ts.isMethodDeclaration(node) && ['offer', 'displayAmount', 'minimumAmount', 'maximumAmount'].includes(node.name.getText(component))) methods.push(node.getText(component));
  ts.forEachChild(node, inspect);
}
inspect(component);
assert.equal(methods.length, 4);
const output = ts.transpileModule(`class RequestFormHarness { ${methods.join('\n')} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const Harness = new Function('displayReferenceAmount', 'referenceAmountToCents', `${output}; return RequestFormHarness;`)(displayReferenceAmount, referenceAmountToCents) as new () => RequestHarness;

function fixture(currency: 'EUR' | 'USD') {
  const harness = new Harness();
  const calls: OfferCall[] = [];
  let error = '';
  let busy = false;
  harness.acting = Object.assign(() => busy, { set: (value: boolean) => { busy = value; } });
  harness.actionError = { set: (value: string) => { error = value; } };
  harness.localization = { currency: () => currency, convertAmount: (amount: number, source: ReferenceCurrency) => convertReferenceAmount(amount, source, currency) };
  harness.marketplace = {
    createOffer: (id: string, cents: number, message: string) => {
      calls.push({ id, cents, message });
      return { subscribe: () => undefined };
    }
  };
  return { harness, calls, error: () => error };
}

describe('provider proposal form contract', () => {
  const request: RequestReference = { id: 'request-test', suggestedSubtotalCents: 14400, currency: 'BRL' };
  it('shows EUR/USD and submits an edited amount in the request currency', () => {
    for (const [currency, displayed, edited] of [['EUR', 24.48, '25.50'], ['USD', 28.80, '30.00']] as const) {
      const { harness, calls } = fixture(currency);
      assert.equal(harness.displayAmount(request), displayed);
      harness.offer(request, edited, '  Includes materials.  ');
      assert.deepEqual(calls, [{ id: request.id, cents: 15000, message: 'Includes materials.' }]);
    }
  });
  it('keeps the original cents when a rounded suggested value is untouched', () => {
    const { harness, calls } = fixture('EUR');
    const roundedRequest = { ...request, suggestedSubtotalCents: 10003 };
    assert.equal(harness.displayAmount(roundedRequest), 17.01);
    harness.offer(roundedRequest, '17.01', '');
    assert.equal(calls[0].cents, 10003);
  });
  it('handles non-BRL requests and the minimum source amount', () => {
    const { harness, calls } = fixture('USD');
    const euroRequest: RequestReference = { ...request, currency: 'EUR', suggestedSubtotalCents: 1700 };
    assert.equal(harness.displayAmount(euroRequest), 20);
    assert.equal(harness.minimumAmount(euroRequest), 11.77);
    harness.offer(euroRequest, '30', '');
    assert.equal(calls[0].cents, 2550);
    assert.equal(fixture('EUR').harness.minimumAmount(request), 1.70);
    assert.equal(fixture('USD').harness.minimumAmount(request), 2.00);
    assert.equal(fixture('EUR').harness.maximumAmount(request), 17000);
    assert.equal(fixture('USD').harness.maximumAmount(request), 20000);
    for (const [amount, cents] of [['1.70', 1000], ['17000', 10000000]] as const) {
      const boundary = fixture('EUR');
      boundary.harness.offer(request, amount, '');
      assert.equal(boundary.calls[0].cents, cents);
    }
  });
  it('rejects invalid values and prevents duplicate submissions', () => {
    for (const amount of ['', ' ', '0', '-1', '0.01', '1.69', '17000.01', 'NaN', 'Infinity']) {
      const { harness, calls, error } = fixture('EUR');
      harness.offer(request, amount, '');
      assert.equal(calls.length, 0);
      assert.ok(error());
    }
    const { harness, calls } = fixture('USD');
    harness.offer(request, '30', '');
    harness.offer(request, '30', '');
    assert.equal(calls.length, 1);
  });
});
