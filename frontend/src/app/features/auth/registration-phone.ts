import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/min';
import type { CountryCode } from 'libphonenumber-js/min';

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'BE';

const callingCodes = getCountries().map((country) => ({ country, code: getCountryCallingCode(country) }));

export function phoneCountryOptions(locale: string) {
  const names = new Intl.DisplayNames(locale, { type: 'region' });
  const alphabet = new Intl.Collator(locale);
  return callingCodes.map((item) => ({ ...item, name: names.of(item.country) ?? item.country }))
    .sort((left, right) => alphabet.compare(left.name, right.name));
}

export function countryForPhone(value: string, preferred: CountryCode): CountryCode | undefined {
  const input = internationalInput(value);
  if (!input.startsWith('+')) return preferred;
  const number = new AsYouType();
  number.input(input);
  const code = number.getCallingCode();
  if (!code) return undefined;

  const detected = number.getCountry();
  if (detected) return detected;
  if (getCountryCallingCode(preferred) === code) return preferred;

  const matches = callingCodes.filter((item) => item.code === code);
  return matches.length === 1 ? matches[0].country : undefined;
}

export function phoneWithCountry(value: string, country: CountryCode): string {
  const input = internationalInput(value);
  let national = input;
  if (input.startsWith('+')) {
    const number = new AsYouType();
    number.input(input);
    national = number.getNumber()?.nationalNumber ?? '';
  }
  return `+${getCountryCallingCode(country)} ${national}`;
}

export function internationalPhone(value: string, country: CountryCode): string | undefined {
  const input = internationalInput(value);
  if (!/^\+?[\d\s().-]+$/.test(input)) return undefined;
  const number = parsePhoneNumberFromString(input, { defaultCountry: country, extract: false });
  return number?.isPossible() ? number.number : undefined;
}

export function phoneFlagUrl(country: CountryCode): string {
  const code = country.toLowerCase();
  const asset = country === 'AC' || country === 'TA' ? 'sh-' + code : code;
  return 'flags/' + asset + '.svg';
}

function internationalInput(value: string): string {
  const input = value.trim();
  return input.startsWith('00') ? '+' + input.slice(2).trimStart() : input;
}
