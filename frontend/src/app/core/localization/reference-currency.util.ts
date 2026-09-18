export type ReferenceCurrency = 'BRL' | 'EUR' | 'USD';

// Fixed reference conversions, not settlement rates or platform charges.
const REFERENCE_RATES: Record<ReferenceCurrency, number> = { BRL: 1, EUR: 0.17, USD: 0.20 };

export function convertReferenceAmount(amount: number, source: ReferenceCurrency, target: ReferenceCurrency): number {
  if (!Number.isFinite(amount) || source === target) return amount;
  return amount / REFERENCE_RATES[source] * REFERENCE_RATES[target];
}

export function displayReferenceAmount(cents: number, source: ReferenceCurrency, target: ReferenceCurrency): number {
  return Math.round(convertReferenceAmount(cents / 100, source, target) * 100) / 100;
}

export function referenceAmountToCents(value: string, display: ReferenceCurrency, source: ReferenceCurrency): number {
  if (!value.trim()) return NaN;
  return Math.round(convertReferenceAmount(Number(value), display, source) * 100);
}
