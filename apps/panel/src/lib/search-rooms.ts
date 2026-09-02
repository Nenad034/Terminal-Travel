// Sobe u pretrazi smeštaja — po sobi: broj odraslih, broj dece i UZRAST SVAKOG deteta.
//
// Oslonac: M5 spec §3.0c.1 i §3.2a (`occupancy.room_config[]` = `{adults, children,
// children_ages[]}` po sobi) i §3.0g.6, gde je uzrast deteta izričito **obavezan**, ne opcion:
// bez njega hotelski API vraća cenu koja se pri potvrdi menja. Backend je ovaj oblik primao od
// početka (`SearchQueryDto.occupancy`, `assertRoomConfigMatchesTotals`) — do 3.9.2026 ga panel
// nikad nije popunjavao, nego je slao jednu sobu sa praznim `childrenAges`, pa je "obavezan
// uzrast" postojao samo na papiru. Ovo je ta rupa, zatvorena na vlasnikov zahtev ("kada se
// unese broj dece treba da se pojave isti broj polja za unos godina dece... takođe treba da
// postoji i link Dodaj sobu sa istom formom").
//
// Zašto zaseban fajl: isti oblik čitaju forma (unos), sažetak kriterijuma (prikaz) i stranica
// pretrage (slanje na API). Tri mesta koja moraju da se slažu = jedan izvor istine.

/** Uzrast se drži kao string jer prazno polje ("još nije uneto") nije broj. */
export interface SearchRoom {
  adults: number;
  childrenAges: string[];
}

/** Vrste proizvoda koje se uopšte cene po sobi — isto kao `ROOM_BASED_TYPES` u SearchService. */
export const ROOM_BASED_TYPES = ['ACCOMMODATION', 'PACKAGE'];

export function isRoomBased(types: string[]): boolean {
  return types.length === 1 && ROOM_BASED_TYPES.includes(types[0]);
}

export const DEFAULT_ROOM: SearchRoom = { adults: 2, childrenAges: [] };

/** Najviše dete koje hoteli još računaju kao dete; iznad toga je odrasla osoba (M3 `age_pricing[]`). */
export const MAX_CHILD_AGE = 17;
/** Gornja granica broja soba u jednoj pretrazi — praktična, ne poslovna. */
export const MAX_ROOMS = 9;

export function parseRooms(raw: string | null | undefined): SearchRoom[] {
  if (!raw) return [{ ...DEFAULT_ROOM }];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [{ ...DEFAULT_ROOM }];
    return parsed.slice(0, MAX_ROOMS).map((r: unknown) => {
      const room = (r ?? {}) as { adults?: unknown; childrenAges?: unknown };
      return {
        adults: Math.max(1, Number(room.adults) || 1),
        childrenAges: Array.isArray(room.childrenAges) ? room.childrenAges.map((a) => String(a ?? '')) : [],
      };
    });
  } catch {
    // Pokvarena vrednost iz adrese (ručno menjan URL) ne sme da obori ekran — vraća se na
    // podrazumevanu sobu, isto kao da parametra nema.
    return [{ ...DEFAULT_ROOM }];
  }
}

/**
 * Prva soba iz zatečenih zbirnih brojeva — za pretrage sačuvane/otvorene pre nego što je unos
 * po sobama postojao (adresa nosi samo `adults`/`children`). Uzrasti ostaju prazni i moraju se
 * uneti pre nove pretrage; stara pretraga se time ne gubi, samo traži jedan podatak više.
 */
export function roomsFromTotals(adults: string, children: string): SearchRoom[] {
  const childCount = Math.max(0, Number(children) || 0);
  return [{ adults: Math.max(1, Number(adults) || 1), childrenAges: Array.from({ length: childCount }, () => '') }];
}

export function serializeRooms(rooms: SearchRoom[]): string {
  return JSON.stringify(rooms);
}

export function totalAdults(rooms: SearchRoom[]): number {
  return rooms.reduce((sum, r) => sum + r.adults, 0);
}

export function totalChildren(rooms: SearchRoom[]): number {
  return rooms.reduce((sum, r) => sum + r.childrenAges.length, 0);
}

/** Menja broj dece u sobi: dodata deca dobijaju prazno polje za uzrast, višak se odseca. */
export function setChildCount(room: SearchRoom, count: number): SearchRoom {
  const next = [...room.childrenAges];
  while (next.length < count) next.push('');
  return { ...room, childrenAges: next.slice(0, count) };
}

/**
 * Uzrast svakog deteta mora biti unet pre pretrage (§3.0g.6). Vraća poruku ili `null`.
 * Namerno se proverava OVDE, a ne tek na serveru: greška posle poslate pretrage stigla bi
 * kao prazna lista rezultata, što korisnik čita kao "nema smeštaja", a ne kao "fali podatak".
 */
export function validateRooms(rooms: SearchRoom[]): string | null {
  for (let i = 0; i < rooms.length; i++) {
    for (const age of rooms[i].childrenAges) {
      if (age.trim() === '') return `Unesite uzrast svakog deteta (soba ${i + 1}) — bez toga cena nije tačna.`;
      const n = Number(age);
      if (!Number.isInteger(n) || n < 0 || n > MAX_CHILD_AGE) {
        return `Uzrast deteta u sobi ${i + 1} mora biti između 0 i ${MAX_CHILD_AGE}.`;
      }
    }
  }
  return null;
}

/** Oblik koji API očekuje (`SearchQueryDto.occupancy`, M5 spec §3.2a). */
export function toOccupancy(rooms: SearchRoom[]) {
  return {
    adults: totalAdults(rooms),
    children: totalChildren(rooms),
    roomConfig: rooms.map((r) => ({
      adults: r.adults,
      children: r.childrenAges.length,
      // Prazan uzrast se IZOSTAVLJA, ne šalje se kao nula — nula je beba (M2 §2.3b `INFANT`),
      // a to je tvrdnja, ne nepoznat podatak. Forma ionako ne pušta prazno; ovo pokriva samo
      // stariji sačuvan link koji uzraste nikad nije ni imao.
      childrenAges: r.childrenAges.filter((a) => a.trim() !== '').map((a) => Number(a)),
    })),
  };
}

/** Kratak opis za red kriterijuma (§3.0g.2) — npr. „2 sobe · 4 odr. + 1 dete (7)". */
export function describeRooms(rooms: SearchRoom[]): string {
  const adults = totalAdults(rooms);
  const ages = rooms.flatMap((r) => r.childrenAges).filter((a) => a !== '');
  const roomsPart = rooms.length > 1 ? `${rooms.length} ${rooms.length < 5 ? 'sobe' : 'soba'} · ` : '';
  const childPart = ages.length > 0 ? ` + ${ages.length} ${ages.length === 1 ? 'dete' : 'dece'} (${ages.join(', ')})` : '';
  return `${roomsPart}${adults} odr.${childPart}`;
}
