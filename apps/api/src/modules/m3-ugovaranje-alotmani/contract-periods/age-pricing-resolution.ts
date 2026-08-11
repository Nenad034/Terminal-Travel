import { AgeCategory } from '@prisma/client';

export interface AgePricingCandidate {
  ageCategory: AgeCategory;
  occupantIndex: number | null;
  minAdultsPresent: number | null;
  pricingMode: string;
  percentage: unknown;
  flatPrice: number | null;
}

/**
 * M3 spec §2.4a — "Razrešavanje kad više redova odgovara istom gostu (najspecifičniji
 * pobeđuje)": 1) tačan occupant_index, 2) bez occupant_index ali sa najvišim zadovoljenim
 * min_adults_present, 3) bez ikakvog uslova (podrazumevani). Vraća `null` kad nijedan red
 * ne odgovara — pozivalac (buduće M5 `Quote` kreiranje) mora eksplicitno odbiti, sistem
 * ovde nikad ne pretpostavlja cenu (§2.4a ograda).
 */
export function resolveAgePricing(
  candidates: AgePricingCandidate[],
  ageCategory: AgeCategory,
  occupantIndex: number,
  adultsPresent: number,
): AgePricingCandidate | null {
  const forCategory = candidates.filter((c) => c.ageCategory === ageCategory);

  const exactIndex = forCategory.find((c) => c.occupantIndex === occupantIndex);
  if (exactIndex) return exactIndex;

  const conditional = forCategory
    .filter((c) => c.occupantIndex === null && c.minAdultsPresent !== null && c.minAdultsPresent <= adultsPresent)
    .sort((a, b) => (b.minAdultsPresent ?? 0) - (a.minAdultsPresent ?? 0));
  if (conditional.length > 0) return conditional[0];

  const fallback = forCategory.find((c) => c.occupantIndex === null && c.minAdultsPresent === null);
  return fallback ?? null;
}
