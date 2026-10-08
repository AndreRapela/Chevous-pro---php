export type CardBrand = 'amex' | 'mastercard' | 'visa' | 'generic';

export function paymentDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCardNumber(value: string): string {
  const digits = paymentDigits(value).slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

export function formatExpiry(value: string): string {
  const digits = paymentDigits(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

export function cardBrand(value: string): CardBrand {
  const digits = paymentDigits(value);
  if (/^3[47]/.test(digits)) return 'amex';
  if (/^(5[1-5]|2(?:2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return 'mastercard';
  if (/^4/.test(digits)) return 'visa';
  return 'generic';
}

export function isValidCardNumber(value: string): boolean {
  const digits = paymentDigits(value);
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index--) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

export function isValidExpiry(value: string, referenceDate = new Date()): boolean {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth() + 1;
  return year > currentYear || (year === currentYear && month >= currentMonth);
}

export function checkoutTotalCents(unitPriceCents: number, quantity: number): number {
  if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0) return 0;
  const safeQuantity = Number.isSafeInteger(quantity) ? Math.max(1, quantity) : 1;
  return unitPriceCents * safeQuantity;
}
