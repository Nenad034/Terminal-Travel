/**
 * M3 spec §2.11i — koliko provizije subagent dobija na jednu stavku cenovnika.
 *
 * Dve stvari koje ovaj modul rešava, a koje pre v1.27 nisu postojale:
 *
 *  1. **Izuzetak po stavci.** Do sada je postojao samo jedan procenat po subagentu, pa se
 *     „na parkingu nema provizije" nije moglo reći nigde.
 *  2. **„Bez provizije" nije isto što i 0%.** Iznos je isti, ali je odluka različita: nula
 *     izgleda kao nepopunjeno polje, a `noCommission` je izričita odluka koja se tako i
 *     prikazuje subagentu. Razlika se vidi tek kad neko pita „zašto ovde nema provizije".
 *
 * Osnovica je **prodajna (bruto) cena** — vlasnikova odluka 9.9.2026: _„Za sada neka ostane
 * da provizija ide na bruto cenu, pa ćemo videti za kasnije."_ To znači da provizija umanjuje
 * ono što ostaje agenciji; preračun na jednake iznose je svesno odložen (backlog).
 */

export type CommissionScope =
  'M3_CONTRACT' | 'M3_SEASON' | 'M3_CONTRACT_PERIOD' | 'M3_RATE_LINE' | 'M3_ANCILLARY_SERVICE';

/** Od najužeg ka najširem — prvi pronađen pobeđuje. */
export const REDOSLED_DOMETA: CommissionScope[] = [
  'M3_RATE_LINE',
  'M3_ANCILLARY_SERVICE',
  'M3_CONTRACT_PERIOD',
  'M3_SEASON',
  'M3_CONTRACT',
];

export interface Izuzetak {
  subagentId: string | null;
  scopeType: CommissionScope;
  scopeId: string;
  noCommission: boolean;
  percentage: number | null;
  fixedAmount: number | null;
  activeFrom: Date | null;
  activeTo: Date | null;
}

export interface KontekstStavke {
  subagentId: string;
  /** Popunjeno je ono što se za tu stavku zna; ostalo ostaje `null`. */
  rateLineId?: string | null;
  ancillaryServiceId?: string | null;
  contractPeriodId?: string | null;
  seasonId?: string | null;
  contractId: string;
  /** Datum na koji se pravilo primenjuje — pri prodaji je to danas. */
  naDan: Date;
}

export interface Provizija {
  /** Najmanja jedinica valute (§2). */
  iznos: number;
  /** Odakle je pravilo došlo — mora se moći objasniti subagentu. */
  izvor: CommissionScope | 'SUBAGENT_DEFAULT';
  bezProvizije: boolean;
}

function dan(v: Date): number {
  return Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate());
}

function vaziNaDan(i: Izuzetak, naDan: Date): boolean {
  if (i.activeFrom && dan(naDan) < dan(i.activeFrom)) return false;
  if (i.activeTo && dan(naDan) > dan(i.activeTo)) return false;
  return true;
}

/** Vrednost dometa iz konteksta — `null` znači da se taj nivo za ovu stavku ne zna. */
function idZaDomet(k: KontekstStavke, s: CommissionScope): string | null {
  switch (s) {
    case 'M3_RATE_LINE':
      return k.rateLineId ?? null;
    case 'M3_ANCILLARY_SERVICE':
      return k.ancillaryServiceId ?? null;
    case 'M3_CONTRACT_PERIOD':
      return k.contractPeriodId ?? null;
    case 'M3_SEASON':
      return k.seasonId ?? null;
    case 'M3_CONTRACT':
      return k.contractId;
  }
}

/**
 * Nađi pravilo koje važi za ovu stavku.
 *
 * Izuzetak vezan za **konkretnog subagenta** pobeđuje isti domet koji važi za sve — inače bi
 * opšte pravilo poništavalo pojedinačan dogovor, što je suprotno od onoga čemu izuzetak služi.
 */
export function nadjiIzuzetak(izuzeci: Izuzetak[], k: KontekstStavke): Izuzetak | null {
  for (const domet of REDOSLED_DOMETA) {
    const id = idZaDomet(k, domet);
    if (!id) continue;
    const kandidati = izuzeci.filter(
      (i) => i.scopeType === domet && i.scopeId === id && vaziNaDan(i, k.naDan),
    );
    const zaOvogSubagenta = kandidati.find((i) => i.subagentId === k.subagentId);
    if (zaOvogSubagenta) return zaOvogSubagenta;
    const zaSve = kandidati.find((i) => i.subagentId === null);
    if (zaSve) return zaSve;
  }
  return null;
}

/**
 * Provizija za jednu stavku, u najmanjoj jedinici valute.
 *
 * `prodajnaCena` je **bruto** — cena koju gost plaća, posle marže (vlasnikova odluka 9.9.2026).
 * Procenat i fiksan iznos se **sabiraju** kad su oba popunjena, isto kao kod marže (§2.11i) —
 * inače bi ista dva polja na dva mesta u sistemu značila dve različite stvari.
 */
export function obracunajProviziju(
  prodajnaCena: number,
  podrazumevanProcenat: number | null,
  izuzetak: Izuzetak | null,
): Provizija {
  if (izuzetak?.noCommission) {
    return { iznos: 0, izvor: izuzetak.scopeType, bezProvizije: true };
  }

  if (izuzetak && (izuzetak.percentage != null || izuzetak.fixedAmount != null)) {
    const odProcenta =
      izuzetak.percentage != null ? Math.round((prodajnaCena * izuzetak.percentage) / 100) : 0;
    return {
      iznos: odProcenta + (izuzetak.fixedAmount ?? 0),
      izvor: izuzetak.scopeType,
      bezProvizije: false,
    };
  }

  // Izuzetak koji ne nosi nijednu vrednost i nije „bez provizije" ne znači ništa — pada se na
  // podrazumevanu stopu subagenta, umesto da se tiho obračuna nula.
  const p = podrazumevanProcenat ?? 0;
  return {
    iznos: Math.round((prodajnaCena * p) / 100),
    izvor: 'SUBAGENT_DEFAULT',
    bezProvizije: false,
  };
}
