import type { Promotion } from '../../../../core/models';
import { rotationWeight } from '../../../../shared/utils/promotion-rotation.util';

export type PromotionDraft = Omit<Promotion, 'id'> & { id?: string };

export function promotionPayload(draft: PromotionDraft): Record<string, unknown> {
  return {
    placement: draft.placement ?? 'home', serviceId: draft.placement === 'services' ? draft.serviceId || null : null,
    title: draft.title.trim(), subtitle: draft.subtitle.trim() || null,
    ctaLabel: draft.ctaLabel.trim() || null, ctaUrl: draft.ctaUrl.trim() || null,
    imageUrl: draft.imageUrl?.trim() || null, mediaType: draft.mediaType ?? 'image',
    mediaFrame: draft.imageUrl?.trim() ? draft.mediaFrame ?? null : null,
    videoDurationMs: draft.videoDurationMs ?? null,
    rotationWeight: rotationWeight(draft.rotationWeight),
    buttonPlacement: draft.buttonPlacement ?? 'banner',
    secondaryLinks: (draft.secondaryLinks ?? []).filter((link) => link.label.trim() && link.url.trim())
      .map((link) => ({ label: link.label.trim(), url: link.url.trim(), placement: link.placement ?? 'below' })),
    badgeText: draft.badgeText.trim() || null,
    termsText: draft.termsText.trim() || null, backgroundColor: draft.backgroundColor,
    textColor: draft.textColor, active: draft.active, sortOrder: draft.sortOrder ?? 0
  };
}
