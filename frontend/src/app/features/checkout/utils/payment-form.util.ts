export function checkoutTotalCents(unitPriceCents: number, quantity: number, shippingCents = 0): number {
  if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0) return 0;
  const safeQuantity = Number.isSafeInteger(quantity) ? Math.max(1, quantity) : 1;
  return unitPriceCents * safeQuantity + shippingCents;
}

export function stripeCheckoutUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.origin === 'https://checkout.stripe.com' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
