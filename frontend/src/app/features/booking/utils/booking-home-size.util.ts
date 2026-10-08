import type { Service } from '../../../core/models';

export interface HomeSizeRange {
  minimum: number;
  maximum: number;
}

export function homeSizeRange(service: Service): HomeSizeRange | null {
  if (service.pricingType === 'area' || service.unit === 'm²') {
    const minimum = Math.max(1, service.minimumQuantity || 1);
    return { minimum, maximum: Math.max(minimum, service.maximumQuantity || 10000) };
  }
  // Cleaning services can have fixed/hourly prices; their area is still useful context.
  // Slugs cover the production catalog, whose category IDs are UUIDs.
  if (service.categoryId === 'cleaning' || /^(limpeza|cleaning)(-|$)/u.test(service.slug)) {
    return { minimum: 20, maximum: 400 };
  }
  return null;
}
