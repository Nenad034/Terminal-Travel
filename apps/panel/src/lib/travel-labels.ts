// Čitljivi nazivi za šifre koje dolaze iz ugovora i kataloga (2.9.2026, na zahtev vlasnika:
// "pišite pun naziv države + oznaka: Grčka (GR)", "kod aranžmana treba da se navede i tip
// smeštajne jedinice i usluga koja je uplaćena").
//
// Princip je isti za sve tri funkcije: **naziv i šifra zajedno, nikad samo jedno.** Naziv je za
// prodavca koji čita ekran, šifra je za komunikaciju sa dobavljačem, vaučer i reklamaciju — ko
// zove hotel kaže "HB", ne "polupansion". Ako se naziv ne zna, prikazuje se sirova šifra: pogrešan
// naziv je gori od nikakvog, jer izgleda kao podatak.

/**
 * ISO-2 šifra države → "Grčka (GR)".
 *
 * Naziv NE dolazi iz ručno održavane liste nego iz `Intl.DisplayNames` — ugrađen u Node i svaki
 * browser, prevodi svih ~250 država i održava ga sam runtime. Ručna lista bi značila da svaka nova
 * destinacija traži izmenu koda, i da neko mora da je prevodi.
 *
 * Locale je `sr-Latn`, ne `sr` — `sr` vraća ćirilicu ("Грчка"), a ceo panel je na latinici.
 */
const REGION_NAMES = new Intl.DisplayNames(['sr-Latn'], { type: 'region' });

export function formatCountry(code?: string | null): string | null {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  // Dvoslovna ISO-2 šifra je jedini oblik koji `Intl` ume da razreši. Ako u bazi stoji nešto
  // drugo (pun naziv, troslovna šifra, greška u unosu), vraća se kako jeste — ne pogađa se.
  if (trimmed.length !== 2) return code;
  let name: string | undefined;
  try {
    name = REGION_NAMES.of(trimmed);
  } catch {
    return code;
  }
  // `Intl` za nepoznatu šifru vraća samu šifru — tada nema šta da se doda u zagradu.
  if (!name || name === trimmed) return trimmed;
  return `${name} (${trimmed})`;
}

// Pansion. U bazi se ista usluga može zateći u DVA oblika: dugom (`HALF_BOARD`, kako ga piše
// implementacija M3/M20) i kratkom, standardnom turističkom (`HB`, kako se piše na vaučeru i
// kako se kaže hotelu). M3 spec §... ostavlja `board_type` kao slobodan tekst bez zatvorene
// liste, pa oba oblika legitimno postoje — zato mapa prihvata oba i UVEK prikazuje kratku,
// standardnu oznaku u zagradi, jer je ona ta koja se koristi u komunikaciji sa dobavljačem.
// (Što `board_type` nema zatvorenu listu je zaseban problem — isti pansion upisan na dva načina
// deli izveštaje u M13; zavedeno kao otvorena stavka u backlogu, ne rešava se ovde.)
const BOARD_LABELS: Record<string, { label: string; code: string }> = {
  RO: { label: 'Samo smeštaj', code: 'RO' },
  ROOM_ONLY: { label: 'Samo smeštaj', code: 'RO' },
  AO: { label: 'Samo smeštaj', code: 'RO' },
  BB: { label: 'Noćenje s doručkom', code: 'BB' },
  BED_AND_BREAKFAST: { label: 'Noćenje s doručkom', code: 'BB' },
  HB: { label: 'Polupansion', code: 'HB' },
  HALF_BOARD: { label: 'Polupansion', code: 'HB' },
  FB: { label: 'Pun pansion', code: 'FB' },
  FULL_BOARD: { label: 'Pun pansion', code: 'FB' },
  AI: { label: 'All inclusive', code: 'AI' },
  ALL_INCLUSIVE: { label: 'All inclusive', code: 'AI' },
  UAI: { label: 'Ultra all inclusive', code: 'UAI' },
  ULTRA_ALL_INCLUSIVE: { label: 'Ultra all inclusive', code: 'UAI' },
  SC: { label: 'Samostalna priprema hrane', code: 'SC' },
  SELF_CATERING: { label: 'Samostalna priprema hrane', code: 'SC' },
};

export function formatBoard(code?: string | null): string | null {
  if (!code) return null;
  const entry = BOARD_LABELS[code.trim().toUpperCase()];
  return entry ? `${entry.label} (${entry.code})` : code;
}

// Tipovi smeštajnih jedinica. Izvor istine je M2 `attributes.room_types[]`, gde svaka soba ima i
// svoju oznaku i naziv — ova lista je privremeni prevod najčešćih standardnih šifri dok ekran
// rezervacije ne počne da čita naziv direktno iz M2 (zavedeno kao otvorena stavka). Zato
// nepoznata šifra i ovde prolazi kao sirov tekst, bez pogađanja.
const ROOM_LABELS: Record<string, string> = {
  SGL: 'Jednokrevetna soba',
  DBL: 'Dvokrevetna soba',
  TWN: 'Dvokrevetna soba (odvojeni kreveti)',
  TPL: 'Trokrevetna soba',
  QUAD: 'Četvorokrevetna soba',
  STD: 'Standardna soba',
  SUP: 'Superior soba',
  DLX: 'Deluxe soba',
  JSUITE: 'Junior apartman',
  SUITE: 'Apartman',
  FAM: 'Porodična soba',
  STUDIO: 'Studio',
  APT: 'Apartman',
  BUNGALOW: 'Bungalov',
};

export function formatRoomType(code?: string | null): string | null {
  if (!code) return null;
  const key = code.trim().toUpperCase();
  const label = ROOM_LABELS[key];
  return label ? `${label} (${key})` : code;
}

/**
 * Popunjenost iz ugovora (`RateLine.occupancy`, npr. "2+1") → "2 odrasla + 1 dete".
 * Format je M3 konvencija: odrasli + deca.
 */
export function formatOccupancy(value?: string | null): string | null {
  if (!value) return null;
  const match = /^(\d+)\s*\+\s*(\d+)$/.exec(value.trim());
  if (!match) return value;
  const adults = Number(match[1]);
  const children = Number(match[2]);
  const adultsLabel = `${adults} ${adults === 1 ? 'odrasla osoba' : 'odraslih'}`;
  if (children === 0) return adultsLabel;
  return `${adultsLabel} + ${children} ${children === 1 ? 'dete' : 'dece'}`;
}
