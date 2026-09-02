// Jedan oblik naziva države kroz ceo sistem — M2 spec §2.1 (`Product.destination_country`).
//
// Zašto postoji: 3.9.2026. je u bazi zatečeno da ista država stoji u dva oblika — `RS` (24
// aktivna proizvoda) i `Srbija` (2), plus `ME` u analitičkim redovima pored `Crna Gora`. Za
// pretragu su to bile DVE različite države: filter po „Srbija" nije nalazio nijedan od onih 24.
// Isti nered je nasledio i AI agent, koji je na pitanje „koliko hotela imamo u Crnoj Gori"
// odgovorio da ih nemamo — a imamo. Agent koji ćuti se vidi; agent koji samouvereno tvrdi
// netačno se ne vidi.
//
// Vlasnikova odluka (3.9.2026): **naš naziv države je izvor istine**, ne ISO kod — naziv čitaju
// i agent i gost direktno, dok bi kod svakako morao negde da se prevodi pre prikaza.
//
// Ovo je ČISTA funkcija bez pristupa bazi, pa je deljena između modula bez kršenja pravila
// modularnih granica (moduli komuniciraju preko API-ja, ali smeju da dele isti pomoćni kod).

/**
 * ISO 3166-1 alpha-2 → naziv koji TT koristi. Namerno kratka lista: države u kojima TT stvarno
 * ima ili očekuje proizvode. Nepoznat kod se NE pogađa — vraća se onako kako je unet (vidi dole).
 */
const ISO_TO_NAME: Record<string, string> = {
  RS: 'Srbija',
  ME: 'Crna Gora',
  GR: 'Grčka',
  IT: 'Italija',
  TR: 'Turska',
  HR: 'Hrvatska',
  BA: 'Bosna i Hercegovina',
  MK: 'Severna Makedonija',
  AL: 'Albanija',
  SI: 'Slovenija',
  BG: 'Bugarska',
  HU: 'Mađarska',
  AT: 'Austrija',
  DE: 'Nemačka',
  FR: 'Francuska',
  ES: 'Španija',
  PT: 'Portugalija',
  CY: 'Kipar',
  EG: 'Egipat',
  AE: 'Ujedinjeni Arapski Emirati',
  MA: 'Maroko',
  TN: 'Tunis',
};

/** Česti drugačiji zapisi istog naziva — bez ovoga bi „Crna gora" i „Crna Gora" bile dve države. */
const NAME_ALIASES: Record<string, string> = {
  'crna gora': 'Crna Gora',
  srbija: 'Srbija',
  grcka: 'Grčka',
  grčka: 'Grčka',
  italija: 'Italija',
  turska: 'Turska',
  hrvatska: 'Hrvatska',
  'bosna i hercegovina': 'Bosna i Hercegovina',
  'severna makedonija': 'Severna Makedonija',
};

/**
 * Vraća naziv države u obliku koji sistem koristi.
 *
 * Pravilo koje se lako pogreši: **nepoznata vrednost se vraća netaknuta** (samo očišćena od
 * viška razmaka), nikad pretvorena u nešto slično. Tiho „popravljanje" nepoznatog naziva bi
 * proizvod premestilo u pogrešnu državu, što je gore od nesređenog podatka — nesređeno se vidi,
 * pogrešno ne.
 */
export function normalizeDestinationCountry<T extends string | null | undefined>(value: T): T {
  if (value === null || value === undefined) return value;
  const trimmed = String(value).trim().replace(/\s+/g, ' ');
  if (trimmed === '') return trimmed as T;

  // ISO kod je uvek tačno dva slova; duže vrednosti su nazivi i ne prolaze kroz ovu tabelu.
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const byIso = ISO_TO_NAME[trimmed.toUpperCase()];
    if (byIso) return byIso as T;
  }

  const byName = NAME_ALIASES[trimmed.toLowerCase()];
  if (byName) return byName as T;

  return trimmed as T;
}

/** Za skripte i izveštaje — da li bi normalizacija promenila vrednost. */
export function needsCountryNormalization(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && normalizeDestinationCountry(value) !== value;
}
