import type { ProviderProfile, ServiceCategory } from '../../core/models';

export function slugifyPublicText(value: string): string {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'profissional';
}

export function providerPublicPath(provider: Pick<ProviderProfile, 'id' | 'name' | 'city'>): string[] {
  return ['/profissionais', provider.id, slugifyPublicText(`${provider.name} ${provider.city}`)];
}

export function categoryPublicPath(category: Pick<ServiceCategory, 'slug'>): string[] {
  return ['/servicos', 'categoria', category.slug];
}
