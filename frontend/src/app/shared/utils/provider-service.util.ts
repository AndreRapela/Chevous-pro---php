/** The API uses a null custom price to mean "use the catalog price", never zero. */
export function normalizeProviderServicePrices<T extends { catalogPriceCents: unknown; customPriceCents?: unknown }>(service: T): T & { catalogPriceCents: number; customPriceCents: number } {
  const catalog = Number(service.catalogPriceCents);
  const catalogPriceCents = Number.isFinite(catalog) ? catalog : 0;
  const custom = service.customPriceCents == null || service.customPriceCents === '' ? catalogPriceCents : Number(service.customPriceCents);
  return { ...service, catalogPriceCents, customPriceCents: Number.isFinite(custom) ? custom : catalogPriceCents };
}
