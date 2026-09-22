export interface PostalCodeAddress {
  postalCode: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

export function postalCodeDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

export function formatPostalCode(value: string): string {
  const digits = postalCodeDigits(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}
