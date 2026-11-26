import { PromotionLink, PromotionMediaFrame } from '../../core/models';

export const DEFAULT_MEDIA_FRAME: PromotionMediaFrame = { fit: 'contain', x: 50, y: 50, size: 100 };

export function promotionLinksAt(links: PromotionLink[] | undefined, place: 'banner' | 'below'): PromotionLink[] {
  return (links ?? []).filter((link) => (link.placement ?? 'below') === place || link.placement === 'both');
}
