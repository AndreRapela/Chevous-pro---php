export const PROMOTION_SLOT_MS = 60_000;
export const NORMAL_ROTATION_WEIGHT = 3;
export const MAX_PROMOTION_VIDEOS = 10;

export function nextPromotionIndex(
  promotions: readonly { rotationWeight?: number }[],
  current = -1,
  random = Math.random
): number {
  if (promotions.length < 2) return 0;
  const candidates = promotions.flatMap((promotion, index) => index === current ? [] : [{
    index,
    weight: rotationWeight(promotion.rotationWeight)
  }]);
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  let ticket = random() * total;
  for (const candidate of candidates) {
    ticket -= candidate.weight;
    if (ticket < 0) return candidate.index;
  }
  return candidates.at(-1)!.index;
}

export function rotationWeight(value: number | undefined): number {
  return value !== undefined && Number.isInteger(value) && value >= 1 && value <= 5 ? value : NORMAL_ROTATION_WEIGHT;
}
