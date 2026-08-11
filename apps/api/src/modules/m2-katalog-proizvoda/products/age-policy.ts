/**
 * M2 spec §2.3b — "Podrazumevana politika (fallback): ako room_types[] stavka nema
 * eksplicitno postavljen age_policy[], primenjuje se sistemski podrazumevan niz."
 */
export interface AgePolicyEntry {
  category: 'ADULT' | 'CHILD' | 'TEEN' | 'INFANT';
  age_from: number;
  age_to: number | null;
  counts_toward_capacity: boolean;
  max_count?: number | null;
  requires_crib?: boolean;
  crib_included?: boolean | null;
}

export const DEFAULT_AGE_POLICY: AgePolicyEntry[] = [
  { category: 'ADULT', age_from: 12, age_to: null, counts_toward_capacity: true },
  { category: 'CHILD', age_from: 2, age_to: 11.99, counts_toward_capacity: true },
  {
    category: 'INFANT',
    age_from: 0,
    age_to: 1.99,
    counts_toward_capacity: false,
    requires_crib: true,
    crib_included: null,
  },
];

interface RoomTypeLike {
  age_policy?: AgePolicyEntry[];
  [key: string]: unknown;
}

/** Popunjava age_policy[] podrazumevanim nizom ako stavka nema eksplicitno postavljen niz. */
export function applyDefaultAgePolicy<T extends RoomTypeLike>(roomType: T): T {
  if (roomType.age_policy && roomType.age_policy.length > 0) return roomType;
  return { ...roomType, age_policy: DEFAULT_AGE_POLICY };
}

export function applyDefaultAgePolicyToRoomTypes<T extends RoomTypeLike>(roomTypes: T[] | undefined): T[] {
  if (!roomTypes) return [];
  return roomTypes.map(applyDefaultAgePolicy);
}
