import { BadRequestException } from '@nestjs/common';
import { AgeCategory } from '@prisma/client';
import { BedCombinationOverride } from '../../m2-katalog-proizvoda/products/bed-combinations';
import { AgePolicyEntry, RoomTypeDefinition } from './occupancy';

/**
 * Čitanje `Product.attributes.room_types[]` (M2 §2.3a/§2.3b/§2.3g) u oblik koji M5 koristi.
 *
 * **Zašto ovo postoji, a nije bio običan `as RoomTypeDefinition[]`:** u bazi je JSON u
 * snake_case (`capacity_adults`, `age_policy`, `bed_combinations`) — tako ga piše i panel i uvoz
 * — a `RoomTypeDefinition` je camelCase. Do 11.9.2026 se čitao pukim castom, pa je
 * `roomType.capacityAdults` bio `undefined` na SVAKOM stvarnom proizvodu (izmereno: 225 soba u
 * snake_case, 0 u camelCase). Posledice su bile tihe, jer `undefined` u poređenju ne puca nego
 * daje `false`:
 *
 * - `assertRoomCapacity` bi, da je iko zove, propuštala svaku grupu (`3 > undefined` je `false`);
 * - `computeRoomBaseCost` je za `roomType.agePolicy` uvek dobijao `undefined` i padao na
 *   `DEFAULT_AGE_POLICY`, pa sobina uzrasna politika nije učestvovala u ceni. Danas to nikome ne
 *   menja iznos (nijedna soba je nema unetu — izmereno 0/225), ali bi promenilo prvoj koja je
 *   unese, i to bez ijedne poruke.
 *
 * Cast prolazi kroz `tsc` jer `as` ne proverava ništa — tip je tvrdio oblik koji podatak nema.
 * Isti obrazac kao zamke 5.13 i 10.1: ugovor između dva sloja koji nijedan alat ne proverava.
 */

interface SiroviTipSobe {
  code?: unknown;
  name?: unknown;
  capacity_adults?: unknown;
  capacityAdults?: unknown;
  capacity_children?: unknown;
  capacityChildren?: unknown;
  min_occupancy?: unknown;
  minOccupancy?: unknown;
  age_policy?: unknown;
  agePolicy?: unknown;
  beds?: unknown;
  bed_combinations?: unknown;
  bedCombinations?: unknown;
}

function broj(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function uzrasnaPolitika(sirovo: unknown): AgePolicyEntry[] | undefined {
  if (!Array.isArray(sirovo) || sirovo.length === 0) return undefined;
  const redovi: AgePolicyEntry[] = [];
  for (const r of sirovo as Record<string, unknown>[]) {
    const kategorija = r.category;
    if (typeof kategorija !== 'string') continue;
    redovi.push({
      category: kategorija as AgeCategory,
      ageFrom: broj(r.age_from ?? r.ageFrom) ?? 0,
      ageTo: broj(r.age_to ?? r.ageTo),
      countsTowardCapacity: (r.counts_toward_capacity ?? r.countsTowardCapacity) !== false,
      maxCount: broj(r.max_count ?? r.maxCount),
      requiresCrib: (r.requires_crib ?? r.requiresCrib) === true,
      cribIncluded:
        typeof (r.crib_included ?? r.cribIncluded) === 'boolean'
          ? ((r.crib_included ?? r.cribIncluded) as boolean)
          : null,
    });
  }
  return redovi.length > 0 ? redovi : undefined;
}

function kreveti(sirovo: unknown): RoomTypeDefinition['beds'] {
  if (!sirovo || typeof sirovo !== 'object') return null;
  const b = sirovo as Record<string, unknown>;
  const osnovnih = broj(b.base_beds ?? b.baseBeds);
  if (osnovnih == null) return null;
  return {
    baseBeds: osnovnih,
    extraBedsMax: broj(b.extra_beds_max ?? b.extraBedsMax),
    extraBedMaxAge: broj(b.extra_bed_max_age ?? b.extraBedMaxAge),
    sharesBedMaxAge: broj(b.shares_bed_max_age ?? b.sharesBedMaxAge),
  };
}

function odstupanja(sirovo: unknown): BedCombinationOverride[] | null {
  if (!Array.isArray(sirovo) || sirovo.length === 0) return null;
  return (sirovo as Record<string, unknown>[])
    .filter((o) => typeof o.key === 'string')
    .map((o) => ({
      key: o.key as string,
      allowed: o.allowed !== false,
      shared_bed_children: broj(o.shared_bed_children ?? o.sharedBedChildren) ?? 0,
      note: typeof o.note === 'string' ? o.note : null,
    }));
}

/** Čita `attributes.room_types[]` (ili `roomTypes[]`) u `RoomTypeDefinition[]`. */
export function parseRoomTypes(attributes: unknown): RoomTypeDefinition[] {
  if (!attributes || typeof attributes !== 'object') return [];
  const a = attributes as Record<string, unknown>;
  const sirovi = a.room_types ?? a.roomTypes;
  if (!Array.isArray(sirovi)) return [];

  const izlaz: RoomTypeDefinition[] = [];
  for (const rt of sirovi as SiroviTipSobe[]) {
    if (typeof rt?.code !== 'string') continue;
    izlaz.push({
      code: rt.code,
      name: typeof rt.name === 'string' ? rt.name : null,
      // `?? 0` je namerno strogo: soba bez unetog kapaciteta ne prima nikoga dok se ne dopuni.
      // Suprotno (`?? 99`) je upravo ono što je zamka 7.14 — provera koja se tiho isključi.
      capacityAdults: broj(rt.capacity_adults ?? rt.capacityAdults) ?? 0,
      capacityChildren: broj(rt.capacity_children ?? rt.capacityChildren) ?? 0,
      minOccupancy: broj(rt.min_occupancy ?? rt.minOccupancy),
      agePolicy: uzrasnaPolitika(rt.age_policy ?? rt.agePolicy),
      beds: kreveti(rt.beds),
      bedCombinations: odstupanja(rt.bed_combinations ?? rt.bedCombinations),
    });
  }
  return izlaz;
}

/**
 * M5 spec §13 (izlazni kriterijum, 10.9.2026): „Nepoznat tip sobe ne sme tiho značiti neograničen
 * kapacitet... Mora biti jasno odbijanje sa porukom, isti princip kao ograda za nedostajuću cenu
 * (M3 §2.4a)."
 *
 * Do ove izmene su i pretraga i ponuda na nepoklopljen tip sobe uzimale
 * `{ capacityAdults: 99, capacityChildren: 99 }` — vrednost izabrana da ništa ne padne, što je
 * isto kao brisanje provere, samo nevidljivo (zamka 7.14).
 */
export function resolveRoomTypeOrThrow(
  roomTypes: RoomTypeDefinition[],
  code: string,
  proizvod: string,
): RoomTypeDefinition {
  const nadjen = roomTypes.find((r) => r.code === code);
  if (nadjen) return nadjen;
  throw new BadRequestException(
    `Tip sobe „${code}" iz cenovnika ne postoji u katalogu proizvoda ${proizvod}, pa se kapacitet ne može proveriti. ` +
      `Povežite ga sa tipom sobe iz šifarnika (M3 spec §2.11m) pre prodaje — M5 spec §3.2a.`,
  );
}
