export const CUSTOM_SERVICE_VALUE = '__other__';

export function cleanServiceName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function serviceNameKey(value: string): string {
  return cleanServiceName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

export function serviceNameExists(value: string, services: ReadonlyArray<{ name: string }>): boolean {
  const key = serviceNameKey(value);
  return Boolean(key) && services.some((service) => serviceNameKey(service.name) === key);
}

export function serviceInitial(value: string): string {
  return Array.from(cleanServiceName(value))[0]?.toLocaleUpperCase('pt-BR') ?? '?';
}
