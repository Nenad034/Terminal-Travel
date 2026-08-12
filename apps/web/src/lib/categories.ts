// M2 spec §2.1/§11 — Product.type enum. Slugovi su srpski (M8 spec primer: "/smestaj/hotel-x")
// pošto je srpski podrazumevani jezik sajta (M8 spec poglavlje 2), nezavisno od aktivnog jezika
// stranice — isti princip kao stabilni URL identifikator koji se ne menja sa jezikom prikaza.
export const CATEGORY_TYPES = [
  { type: 'ACCOMMODATION', slug: 'smestaj' },
  { type: 'PACKAGE', slug: 'aranzmani' },
  { type: 'EXCURSION', slug: 'izleti' },
  { type: 'TRANSFER', slug: 'transferi' },
  { type: 'TRANSPORT', slug: 'prevoz' },
  { type: 'FLIGHT', slug: 'letovi' },
  { type: 'TICKET', slug: 'karte' },
  { type: 'EVENT', slug: 'dogadjaji' },
  { type: 'INSURANCE', slug: 'osiguranje' },
] as const;

export type ProductType = (typeof CATEGORY_TYPES)[number]['type'];

export function typeToSlug(type: string): string {
  return CATEGORY_TYPES.find((c) => c.type === type)?.slug ?? type.toLowerCase();
}

export function slugToType(slug: string): string | undefined {
  return CATEGORY_TYPES.find((c) => c.slug === slug)?.type;
}
