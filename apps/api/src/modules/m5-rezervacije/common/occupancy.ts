import { BadRequestException } from '@nestjs/common';
import { AgeCategory } from '@prisma/client';
import { resolveAgePricing, AgePricingCandidate } from '../../m3-ugovaranje-alotmani/contract-periods/age-pricing-resolution';

// M5 spec §3.2a — jedna stavka u occupancy.room_config[].
export interface RoomConfigEntry {
  roomTypeCode?: string | null;
  adults: number;
  children: number;
  childrenAges?: number[] | null;
}

export interface OccupancyInput {
  adults: number;
  children: number;
  roomConfig?: RoomConfigEntry[] | null;
}

// M2 spec §2.3b — age_policy[] stavka jedne room_types[] konfiguracije.
export interface AgePolicyEntry {
  category: AgeCategory;
  ageFrom: number;
  ageTo: number | null;
  countsTowardCapacity: boolean;
  maxCount: number | null;
  requiresCrib: boolean;
  cribIncluded: boolean | null;
}

export interface RoomTypeDefinition {
  code: string;
  capacityAdults: number;
  capacityChildren: number;
  agePolicy?: AgePolicyEntry[];
}

// M2 spec §2.3b — "podrazumevana politika (fallback)" kad room_types[] stavka nema
// eksplicitno postavljen age_policy[].
export const DEFAULT_AGE_POLICY: AgePolicyEntry[] = [
  { category: 'ADULT', ageFrom: 12, ageTo: null, countsTowardCapacity: true, maxCount: null, requiresCrib: false, cribIncluded: null },
  { category: 'CHILD', ageFrom: 2, ageTo: 11.99, countsTowardCapacity: true, maxCount: null, requiresCrib: false, cribIncluded: null },
  { category: 'INFANT', ageFrom: 0, ageTo: 1.99, countsTowardCapacity: false, maxCount: null, requiresCrib: true, cribIncluded: null },
];

// M2 spec §2.3b — svrstavanje uzrasta u kategoriju po age_from/age_to (age_to = null znači "i više").
export function classifyAge(ageYears: number, agePolicy: AgePolicyEntry[]): AgePolicyEntry {
  const match = agePolicy.find((p) => ageYears >= p.ageFrom && (p.ageTo === null || ageYears <= p.ageTo));
  if (!match) {
    throw new BadRequestException(
      `Uzrast ${ageYears} ne odgovara nijednoj kategoriji age_policy ove sobe (M2 spec §2.3b) — dopunite politiku pre nastavka.`,
    );
  }
  return match;
}

export interface ClassifiedGuest {
  category: AgeCategory;
  occupantIndex: number; // redni broj unutar kategorije (M5 spec §3.2b, korak 1)
  requiresCrib: boolean;
}

// M5 spec §3.2b, korak 1 — svrstaj svakog gosta jedne sobe u kategoriju, dodeli occupant_index
// po redosledu unutar kategorije (odrasli su uvek ADULT; deca se svrstavaju preko children_ages[]).
export function classifyRoomGuests(room: RoomConfigEntry, agePolicy: AgePolicyEntry[]): ClassifiedGuest[] {
  const guests: ClassifiedGuest[] = [];
  for (let i = 0; i < room.adults; i++) {
    guests.push({ category: 'ADULT', occupantIndex: i + 1, requiresCrib: false });
  }
  const perCategoryCounter = new Map<AgeCategory, number>();
  for (const age of room.childrenAges ?? []) {
    const policy = classifyAge(age, agePolicy);
    const next = (perCategoryCounter.get(policy.category) ?? 0) + 1;
    perCategoryCounter.set(policy.category, next);
    guests.push({ category: policy.category, occupantIndex: next, requiresCrib: policy.requiresCrib });
  }
  return guests;
}

// M5 spec §3.2a — "Pravilo slaganja: zbir adults/children preko svih stavki room_config[]
// mora odgovarati occupancy.adults/children na nivou cele stavke." Neusklađen zbir se odbija.
export function assertRoomConfigMatchesTotals(occupancy: OccupancyInput): RoomConfigEntry[] {
  const roomConfig: RoomConfigEntry[] =
    occupancy.roomConfig && occupancy.roomConfig.length > 0
      ? occupancy.roomConfig
      : [{ roomTypeCode: null, adults: occupancy.adults, children: occupancy.children, childrenAges: null }];

  const sumAdults = roomConfig.reduce((s, r) => s + r.adults, 0);
  const sumChildren = roomConfig.reduce((s, r) => s + r.children, 0);
  if (sumAdults !== occupancy.adults || sumChildren !== occupancy.children) {
    throw new BadRequestException(
      `Zbir adults/children u room_config[] (${sumAdults}/${sumChildren}) ne odgovara occupancy.adults/children (${occupancy.adults}/${occupancy.children}) — M5 spec §3.2a.`,
    );
  }
  return roomConfig;
}

// M5 spec §3.2a — validacija kapaciteta po uzrastu. Samo kategorije sa counts_toward_capacity=true
// se broje protiv capacity_adults/capacity_children; max_count po kategoriji se sprovodi nezavisno.
export function assertRoomCapacity(room: RoomConfigEntry, roomType: RoomTypeDefinition): void {
  const agePolicy = roomType.agePolicy && roomType.agePolicy.length > 0 ? roomType.agePolicy : DEFAULT_AGE_POLICY;
  const guests = classifyRoomGuests(room, agePolicy);

  const perCategoryCount = new Map<AgeCategory, number>();
  for (const g of guests) perCategoryCount.set(g.category, (perCategoryCount.get(g.category) ?? 0) + 1);

  for (const policy of agePolicy) {
    const count = perCategoryCount.get(policy.category) ?? 0;
    if (policy.maxCount != null && count > policy.maxCount) {
      throw new BadRequestException(
        `Broj gostiju kategorije ${policy.category} (${count}) prelazi max_count (${policy.maxCount}) za sobu ${roomType.code} (M2 spec §2.3a).`,
      );
    }
  }

  const countingAdults = guests.filter((g) => g.category === 'ADULT' && agePolicy.find((p) => p.category === 'ADULT')?.countsTowardCapacity).length;
  const countingChildren = guests.filter((g) => {
    if (g.category === 'ADULT') return false;
    const policy = agePolicy.find((p) => p.category === g.category);
    return policy?.countsTowardCapacity ?? false;
  }).length;

  if (countingAdults > roomType.capacityAdults || countingChildren > roomType.capacityChildren) {
    throw new BadRequestException(
      `Traženi broj gostiju premašuje kapacitet sobe ${roomType.code} (M2 spec §2.3a/§2.3b).`,
    );
  }
}

// M5 spec §3.2b, korak 2 — pokušaj da se iz slobodnog teksta RateLine.occupancy izvede broj
// ADULT gostiju pokrivenih osnovnom cenom. `RateLine.occupancy` je NENAMERNO nestrukturiran
// string na M3 nivou (M3 spec §2.4) — ovo je dokumentovana interpretacija, ne tiha pretpostavka
// (vidi docs/moduli/M05-rezervacije/06-SPECIFIKACIJA-M5-REZERVACIJE.md §13, otvoreno pitanje):
// prepoznati srpski nazivi popunjenosti imaju prioritet; ako ništa ne odgovara, podrazumeva se
// da osnovna cena pokriva tačno onoliko odraslih koliko je traženo za tu sobu (nema dodatne
// naplate za odrasle kad se ne može pouzdano utvrditi osnovna popunjenost) — deca/tinejdžeri/bebe
// se i dalje uvek naplaćuju preko age_pricing[] (korak 4), bez obzira na ovu pretpostavku.
export function resolveBaseAdultsCovered(occupancyText: string, adultsInRoom: number): number {
  const normalized = occupancyText.toLowerCase();
  if (normalized.includes('jednokrevetn') || normalized.includes('single')) return Math.min(1, adultsInRoom);
  if (normalized.includes('dvokrevetn') || normalized.includes('double') || normalized.includes('twin')) return Math.min(2, adultsInRoom);
  if (normalized.includes('trokrevetn') || normalized.includes('triple')) return Math.min(3, adultsInRoom);
  if (normalized.includes('četvorokrevetn') || normalized.includes('cetvorokrevetn') || normalized.includes('quad')) return Math.min(4, adultsInRoom);
  const numericMatch = normalized.match(/\d+/);
  if (numericMatch) return Math.min(parseInt(numericMatch[0], 10), adultsInRoom);
  return adultsInRoom;
}

export interface RateLineForCalc {
  price: number;
  priceBasis: 'PER_ROOM_PER_NIGHT' | 'PER_PERSON_PER_NIGHT';
  occupancy: string;
  cribFeePerNight: number | null;
}

// M5 spec §3.2b — računanje base_cost jedne sobe za ceo boravak (korak 1-6), determinističko.
export function computeRoomBaseCost(params: {
  room: RoomConfigEntry;
  roomType: RoomTypeDefinition;
  rateLine: RateLineForCalc;
  agePricingCandidates: AgePricingCandidate[];
  nights: number;
}): number {
  const { room, roomType, rateLine, agePricingCandidates, nights } = params;
  if (nights <= 0) {
    throw new BadRequestException('Broj noćenja mora biti pozitivan (stay_to > stay_from).');
  }

  const agePolicy = roomType.agePolicy && roomType.agePolicy.length > 0 ? roomType.agePolicy : DEFAULT_AGE_POLICY;
  const guests = classifyRoomGuests(room, agePolicy);
  const adultsPresent = room.adults;

  // korak 2/3 — osnovna popunjenost i osnovna cena.
  const baseAdultsCovered = resolveBaseAdultsCovered(rateLine.occupancy, room.adults);
  const basePricePerNight =
    rateLine.priceBasis === 'PER_ROOM_PER_NIGHT' ? rateLine.price : rateLine.price * baseAdultsCovered;

  // korak 4 — svaki gost iznad osnovne popunjenosti (dodatni ADULT, i svaki CHILD/TEEN/INFANT).
  let extraPerNight = 0;
  let adultsCounted = 0;
  for (const guest of guests) {
    if (guest.category === 'ADULT') {
      adultsCounted++;
      if (adultsCounted <= baseAdultsCovered) continue; // pokriven osnovnom cenom, ne obračunava se posebno
    }
    const resolved = resolveAgePricing(agePricingCandidates, guest.category, guest.occupantIndex, adultsPresent);
    if (!resolved) {
      throw new BadRequestException(
        `Nema odgovarajućeg age_pricing reda za gosta kategorije ${guest.category} (M3 spec §2.4a) — cena se ne pretpostavlja, kreiranje Ponude se odbija (M5 spec §3.2b).`,
      );
    }
    extraPerNight +=
      resolved.pricingMode === 'PERCENTAGE_OF_BASE_PRICE'
        ? Math.round(rateLine.price * (Number(resolved.percentage) / 100))
        : (resolved.flatPrice ?? 0);
  }

  // korak 5 — krevetac, jednom po traženom krevetcu.
  const cribGuests = guests.filter((g) => g.requiresCrib).length;
  const cribFeePerNight = rateLine.cribFeePerNight != null ? rateLine.cribFeePerNight * cribGuests : 0;

  const perNight = basePricePerNight + extraPerNight + cribFeePerNight;
  return perNight * nights;
}
