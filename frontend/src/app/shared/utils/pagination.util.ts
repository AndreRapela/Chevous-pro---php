export function pageFromMeta(meta: Record<string, unknown> | undefined, key: string): number {
  const value = Number(meta?.[key]);
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}

export function totalFromMeta(meta: Record<string, unknown> | undefined): number {
  const value = Number(meta?.['total']);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function mergeUniqueById<T extends { id: string }>(primary: T[], secondary: T[]): T[] {
  const known = new Set(primary.map((item) => item.id));
  return [
    ...primary,
    ...secondary.filter((item) => {
      if (known.has(item.id)) return false;
      known.add(item.id);
      return true;
    })
  ];
}
