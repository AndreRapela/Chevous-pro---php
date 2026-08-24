import type { AvailabilityRule } from '../../../core/models';

export interface ProviderSlots {
  providerId: string;
  slots: string[];
}

export function mergeAvailableSlots(results: ProviderSlots[]): string[] {
  return [...new Set(results.flatMap((result) => result.slots))].sort();
}

export function providerIdsForSlot(results: ProviderSlots[], slot: string): Set<string> {
  return new Set(results.filter((result) => result.slots.includes(slot)).map((result) => result.providerId));
}

export function hasOverlappingRules(rules: AvailabilityRule[]): boolean {
  const sorted = [...rules].sort((left, right) => left.weekday - right.weekday || left.startTime.localeCompare(right.startTime));
  return sorted.some((rule, index) => !rule.startTime || !rule.endTime || rule.startTime >= rule.endTime || (index > 0 && sorted[index - 1]!.weekday === rule.weekday && sorted[index - 1]!.endTime > rule.startTime));
}
