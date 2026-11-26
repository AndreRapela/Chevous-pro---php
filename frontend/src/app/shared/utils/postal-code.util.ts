import type { AbstractControl, ValidationErrors } from '@angular/forms';

export interface PostalCodeAddress {
  postalCode: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  localities?: string[];
}

export const POSTAL_CODE_PATTERN = /^(?:\d{4}|\d{5}-?\d{3})$/;

export function isBrazilianPostalCode(value: string): boolean {
  return /^\d{5}-?\d{3}$/.test(value);
}

export function validateAddressRegion(group: AbstractControl): ValidationErrors | null {
  const postalCode = group.get('postalCode')?.value ?? '';
  if (isBrazilianPostalCode(postalCode) && (!group.get('neighborhood')?.value?.trim() || group.get('state')?.value?.trim().length !== 2)) {
    return { brazilianRegionRequired: true };
  }
  return null;
}

export function postalCodeDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

export function formatPostalCode(value: string): string {
  const digits = postalCodeDigits(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}
