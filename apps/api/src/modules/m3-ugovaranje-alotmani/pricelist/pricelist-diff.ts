/**
 * M3 spec §2.11l — poređenje dve verzije cenovnika.
 *
 * Vlasnikova rečenica koja je ovo tražila: _„Moramo sve iz početka, menjamo ono što su oni
 * promenili. AI agent može da vidi šta je promenjeno pa samo to da koriguje."_
 *
 * Suština je jedan pojam: **ključ stavke**. Dve stavke su „ista stavka u dve verzije" ako im se
 * poklapa sve osim cene — tip sobe, sezona, pansion, popunjenost, osnova cene i dani u nedelji.
 * Kad se ključ poklopi a cena ne, to je **izmena** (stara → nova). Ključ koji postoji samo u
 * novoj je **nova stavka**; ključ koji postoji samo u staroj je **ugašena stavka**.
 *
 * Zašto ključ ne uključuje cenu: da promena cene ne bi izgledala kao „jedna stavka nestala i
 * jedna nova se pojavila". Čovek koji potvrđuje razliku mora da vidi 100,00 → 110,00, ne dva
 * odvojena reda koja mora sam da spoji.
 *
 * Ovde nema ni baze ni HTTP-a — ulaz je snimak, izlaz je lista razlika. To je namerno: isti
 * proračun koristi i ručna izmena u mreži, i uvoz dokumenta (§4.2), i izmena rečima (§4.8).
 */

/** Šta se u snimku vodi kao jedna stavka cenovnika. */
export type VrstaStavke = 'CENA' | 'DOPLATA';

export interface SnapshotRed {
  vrsta: VrstaStavke;
  /** Ključ po kom se stavka prepoznaje između dve verzije — sve osim vrednosti koja se menja. */
  kljuc: string;
  /** Čitljiv opis stavke za ekran („Studio · sezona 1 · BB · 2ADT"). */
  opis: string;
  /** Vrednost koja se poredi — cena u najmanjoj jedinici valute, ili iznos doplate. */
  vrednost: number | null;
  /** Ostala polja koja se porede uz vrednost (prozor prodaje, obaveznost doplate…). */
  detalji?: Record<string, string | number | boolean | null>;
}

export type VrstaRazlike = 'IZMENJENA' | 'NOVA' | 'UGASENA';

export interface Razlika {
  kljuc: string;
  vrsta: VrstaRazlike;
  stavka: VrstaStavke;
  opis: string;
  /** Rečenica za ekran — ono što čovek zapravo potvrđuje. */
  poruka: string;
  staraVrednost: number | null;
  novaVrednost: number | null;
  /** Polja koja su se promenila a nisu cena (npr. „prodaja do": 31.12.2026 → 15.01.2027). */
  izmenjenaPolja: { polje: string; staro: string | null; novo: string | null }[];
}

/** Ključ cenovnog reda. Dani u nedelji ulaze u ključ jer vikend cena JESTE druga stavka. */
export function kljucCene(r: {
  roomType: string;
  seasonCode: string;
  boardType: string;
  occupancy: string;
  priceBasis: string;
  validWeekdays?: number[] | null;
}): string {
  const dani = [...new Set(r.validWeekdays ?? [])].sort((a, b) => a - b);
  return [
    'CENA',
    r.roomType,
    r.seasonCode,
    r.boardType,
    r.occupancy,
    r.priceBasis,
    dani.length === 0 ? 'svi' : dani.join('-'),
  ].join('|');
}

/**
 * Ključ doplate/popusta. Namerno NE koristi `id` zapisa: nov cenovnik od dobavljača donosi nove
 * zapise, pa bi poređenje po id-u svaku doplatu prikazalo kao „ugašena + nova". Ime stavke uz
 * domet je ono po čemu je čovek i prepoznaje.
 */
export function kljucDoplate(a: {
  name: string;
  kind: string;
  seasonCode: string | null;
  roomTypes?: string[] | null;
  ageFrom?: number | null;
  ageTo?: number | null;
}): string {
  const sobe = [...(a.roomTypes ?? [])].sort();
  const uzrast =
    a.ageFrom == null && a.ageTo == null ? 'svi' : `${a.ageFrom ?? 0}-${a.ageTo ?? '∞'}`;
  return [
    'DOPLATA',
    a.name.trim().toLowerCase(),
    a.kind,
    a.seasonCode ?? 'ceo-ugovor',
    sobe.length === 0 ? 'sve-sobe' : sobe.join('-'),
    uzrast,
  ].join('|');
}

function novac(v: number | null): string {
  if (v == null) return '—';
  return (v / 100).toFixed(2).replace('.', ',');
}

/**
 * Poređenje dva snimka. Redosled izlaza je namerno: prvo izmene (najčešći i najosetljiviji
 * slučaj — neko je promenio cenu), pa nove stavke, pa ugašene.
 */
export function uporedi(stara: SnapshotRed[], nova: SnapshotRed[]): Razlika[] {
  const staraMapa = new Map(stara.map((r) => [r.kljuc, r]));
  const novaMapa = new Map(nova.map((r) => [r.kljuc, r]));

  const izmenjene: Razlika[] = [];
  const nove: Razlika[] = [];
  const ugasene: Razlika[] = [];

  for (const n of nova) {
    const s = staraMapa.get(n.kljuc);
    if (!s) {
      nove.push({
        kljuc: n.kljuc,
        vrsta: 'NOVA',
        stavka: n.vrsta,
        opis: n.opis,
        poruka: `Nova stavka: ${n.opis} — ${novac(n.vrednost)}`,
        staraVrednost: null,
        novaVrednost: n.vrednost,
        izmenjenaPolja: [],
      });
      continue;
    }

    const poljaIzmene = uporediDetalje(s.detalji, n.detalji);
    const cenaIzmenjena = s.vrednost !== n.vrednost;
    if (!cenaIzmenjena && poljaIzmene.length === 0) continue;

    izmenjene.push({
      kljuc: n.kljuc,
      vrsta: 'IZMENJENA',
      stavka: n.vrsta,
      opis: n.opis,
      poruka: cenaIzmenjena
        ? `${n.opis}: ${novac(s.vrednost)} → ${novac(n.vrednost)}`
        : `${n.opis}: ${poljaIzmene.map((p) => `${p.polje} ${p.staro ?? '—'} → ${p.novo ?? '—'}`).join(', ')}`,
      staraVrednost: s.vrednost,
      novaVrednost: n.vrednost,
      izmenjenaPolja: poljaIzmene,
    });
  }

  for (const s of stara) {
    if (novaMapa.has(s.kljuc)) continue;
    ugasene.push({
      kljuc: s.kljuc,
      vrsta: 'UGASENA',
      stavka: s.vrsta,
      opis: s.opis,
      poruka: `Više ne postoji: ${s.opis} (bilo ${novac(s.vrednost)})`,
      staraVrednost: s.vrednost,
      novaVrednost: null,
      izmenjenaPolja: [],
    });
  }

  return [...izmenjene, ...nove, ...ugasene];
}

/**
 * Polja van cene koja se porede. Prazan objekat sa obe strane ne pravi razliku; polje koje
 * postoji samo u jednoj verziji se poredi prema `null` — nedostatak vrednosti JESTE izmena
 * („prodaja do 31.12." pa uklonjeno nije isto što i oduvek bez roka).
 */
function uporediDetalje(
  staro: SnapshotRed['detalji'],
  novo: SnapshotRed['detalji'],
): Razlika['izmenjenaPolja'] {
  const s = staro ?? {};
  const n = novo ?? {};
  const polja = [...new Set([...Object.keys(s), ...Object.keys(n)])].sort();
  const razlike: Razlika['izmenjenaPolja'] = [];
  for (const p of polja) {
    const a = s[p] ?? null;
    const b = n[p] ?? null;
    if (a === b) continue;
    razlike.push({
      polje: p,
      staro: a === null ? null : String(a),
      novo: b === null ? null : String(b),
    });
  }
  return razlike;
}
