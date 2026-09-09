'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api-client';
import { uNajmanjuJedinicu, brojIzUnosa as broj } from '@/lib/novac';

// M3 spec §2.11 — cenovnik kao mreža.

function poruka(err: unknown, podrazumevana: string): string {
  if (err instanceof ApiError) {
    const telo = err.body as { message?: string | string[] } | undefined;
    const m = telo?.message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
  }
  return podrazumevana;
}

export interface Ishod {
  error: string | null;
}

export interface OpsegUnos {
  dateFrom: string;
  dateTo: string;
}

export async function sacuvajSezonu(
  contractId: string,
  seasonId: string | null,
  telo: { code: string; label?: string; rank?: number; ranges: OpsegUnos[] },
): Promise<Ishod> {
  try {
    await apiFetch(
      seasonId
        ? `/contracting/contracts/${contractId}/seasons/${seasonId}`
        : `/contracting/contracts/${contractId}/seasons`,
      { method: seasonId ? 'PATCH' : 'POST', body: telo },
    );
  } catch (err) {
    return { error: poruka(err, 'Čuvanje sezone nije uspelo.') };
  }
  revalidatePath(`/ugovori/${contractId}/cenovnik`);
  return { error: null };
}

export async function obrisiSezonu(contractId: string, seasonId: string): Promise<Ishod> {
  try {
    await apiFetch(`/contracting/contracts/${contractId}/seasons/${seasonId}`, {
      method: 'DELETE',
    });
  } catch (err) {
    return { error: poruka(err, 'Brisanje sezone nije uspelo.') };
  }
  revalidatePath(`/ugovori/${contractId}/cenovnik`);
  return { error: null };
}

/**
 * Upis jedne ćelije. Cena stiže sa ekrana kao „89,50" i ovde postaje 8950 — korisnik nikad ne
 * kuca najmanju jedinicu valute (§2.11, vlasnikov nalaz nad starom formom).
 */
export async function upisiCeliju(
  contractId: string,
  telo: {
    seasonId: string;
    roomType: string;
    boardType: string;
    occupancy: string;
    priceBasis: string;
    cena: string;
    /** §2.11d — dani u nedelji (1 = ponedeljak … 7 = nedelja); prazno = svi dani. */
    validWeekdays?: number[];
    bookingFrom?: string;
    bookingTo?: string;
  },
): Promise<Ishod> {
  const price = uNajmanjuJedinicu(telo.cena);
  if (price == null) {
    return { error: `„${telo.cena}" nije iznos. Unesite na primer 89,50.` };
  }

  try {
    await apiFetch(`/contracting/contracts/${contractId}/pricelist-grid/cell`, {
      method: 'PUT',
      body: {
        seasonId: telo.seasonId,
        roomType: telo.roomType,
        boardType: telo.boardType,
        occupancy: telo.occupancy,
        priceBasis: telo.priceBasis,
        price,
        validWeekdays: telo.validWeekdays ?? [],
        bookingFrom: telo.bookingFrom || undefined,
        bookingTo: telo.bookingTo || undefined,
      },
    });
  } catch (err) {
    return { error: poruka(err, 'Upis cene nije uspeo.') };
  }
  revalidatePath(`/ugovori/${contractId}/cenovnik`);
  return { error: null };
}

// ── doplate i popusti (§2.11j/§2.11k)

export interface DoplataUnos {
  name: string;
  kind: string;
  pricingMode: string;
  iznos: string;
  priceBasis: string;
  payable: string;
  isMandatory: string;
  seasonId: string;
  ageFrom: string;
  ageTo: string;
  appliesFrom: string;
  appliesTo: string;
  bookingTo: string;
  appliesToRoomTypes: string[];
}

export async function dodajDoplatu(contractId: string, u: DoplataUnos): Promise<Ishod> {
  const jeFiksan = u.pricingMode === 'FLAT_PER_UNIT';

  // Iznos se kuca kao „1,50", procenat kao „50" — dve različite stvari u istom polju, pa se
  // i pretvaraju različito. Fiksan iznos ide u najmanju jedinicu valute, procenat ostaje broj.
  let flatAmount: number | undefined;
  let percentageOfNightlyRate: number | undefined;
  if (jeFiksan) {
    const n = uNajmanjuJedinicu(u.iznos);
    if (n == null) return { error: `„${u.iznos}" nije iznos. Unesite na primer 1,50.` };
    flatAmount = n;
  } else {
    const n = broj(u.iznos);
    if (n == null || n < 0 || n > 100) {
      return { error: `„${u.iznos}" nije procenat između 0 i 100.` };
    }
    percentageOfNightlyRate = n;
  }

  try {
    await apiFetch(`/contracting/contracts/${contractId}/pricelist-surcharges`, {
      method: 'POST',
      body: {
        name: u.name.trim(),
        kind: u.kind,
        pricingMode: u.pricingMode,
        flatAmount,
        percentageOfNightlyRate,
        priceBasis: u.priceBasis,
        payable: u.payable,
        isMandatory: u.isMandatory === 'true',
        seasonId: u.seasonId || undefined,
        appliesToRoomTypes: u.appliesToRoomTypes,
        appliesFrom: u.appliesFrom || undefined,
        appliesTo: u.appliesTo || undefined,
        ageFrom: broj(u.ageFrom) ?? undefined,
        ageTo: broj(u.ageTo) ?? undefined,
        bookingTo: u.bookingTo || undefined,
      },
    });
  } catch (err) {
    return { error: poruka(err, 'Upis doplate nije uspeo.') };
  }
  revalidatePath(`/ugovori/${contractId}/cenovnik`);
  return { error: null };
}

export async function ugasiDoplatu(contractId: string, id: string): Promise<Ishod> {
  try {
    await apiFetch(`/contracting/contracts/${contractId}/pricelist-surcharges/${id}`, {
      method: 'DELETE',
    });
  } catch (err) {
    return { error: poruka(err, 'Gašenje stavke nije uspelo.') };
  }
  revalidatePath(`/ugovori/${contractId}/cenovnik`);
  return { error: null };
}

// ── marža i provizija po stavci (§2.11i)

export interface PraviloUnos {
  target: 'RATE_LINE' | 'ANCILLARY';
  targetId: string;
  markupPercentage: string;
  markupFixedAmount: string;
  noCommission: string;
  commissionPercentage: string;
  commissionFixedAmount: string;
}

export async function sacuvajPravilo(contractId: string, u: PraviloUnos): Promise<Ishod> {
  // Prazno polje znači „kao ugovor" i mora ostati NEPOSLATO — poslata nula bi značila
  // „marža 0%", što je sasvim druga odluka.
  const markupPercentage = broj(u.markupPercentage) ?? undefined;
  const commissionPercentage = broj(u.commissionPercentage) ?? undefined;
  const bez = u.noCommission === 'true';

  let markupFixedAmount: number | undefined;
  if (u.markupFixedAmount.trim() !== '') {
    const n = uNajmanjuJedinicu(u.markupFixedAmount);
    if (n == null) return { error: `Marža „${u.markupFixedAmount}" nije iznos.` };
    markupFixedAmount = n;
  }

  let commissionFixedAmount: number | undefined;
  if (!bez && u.commissionFixedAmount.trim() !== '') {
    const n = uNajmanjuJedinicu(u.commissionFixedAmount);
    if (n == null) return { error: `Provizija „${u.commissionFixedAmount}" nije iznos.` };
    commissionFixedAmount = n;
  }

  try {
    await apiFetch(`/contracting/contracts/${contractId}/pricing-rules`, {
      method: 'PUT',
      body: {
        target: u.target,
        targetId: u.targetId,
        markupPercentage,
        markupFixedAmount,
        noCommission: bez ? true : undefined,
        commissionPercentage: bez ? undefined : commissionPercentage,
        commissionFixedAmount: bez ? undefined : commissionFixedAmount,
      },
    });
  } catch (err) {
    return { error: poruka(err, 'Upis pravila nije uspeo.') };
  }
  revalidatePath(`/ugovori/${contractId}/cenovnik`);
  return { error: null };
}

export async function ukloniPravilo(
  contractId: string,
  target: 'RATE_LINE' | 'ANCILLARY',
  targetId: string,
): Promise<Ishod> {
  try {
    await apiFetch(`/contracting/contracts/${contractId}/pricing-rules/remove`, {
      method: 'POST',
      body: { target, targetId },
    });
  } catch (err) {
    return { error: poruka(err, 'Uklanjanje pravila nije uspelo.') };
  }
  revalidatePath(`/ugovori/${contractId}/cenovnik`);
  return { error: null };
}

/**
 * M3 spec §2.11l — potvrda trenutnog stanja cenovnika kao nove verzije.
 *
 * Ne šalje cene: cene su već upisane kroz mrežu. Šalje se samo od kada nova cena važi i zašto
 * je verzija nastala — verzija je zapis o izmenama, ne još jedan način da se cena upiše.
 */
export async function potvrdiVerziju(
  contractId: string,
  telo: { effectiveFrom: string; note?: string },
): Promise<Ishod> {
  try {
    await apiFetch(`/contracting/contracts/${contractId}/pricelist-versions`, {
      method: 'POST',
      body: telo,
    });
  } catch (err) {
    return { error: poruka(err, 'Snimanje verzije cenovnika nije uspelo.') };
  }
  revalidatePath(`/ugovori/${contractId}/cenovnik`);
  return { error: null };
}

/**
 * M3 spec §2.11o — kalendar cena i raspoloživosti (pregled, ne unos).
 *
 * Sastav gostiju je deo upita jer cena bez njega ne postoji čim cenovnik ima cenu po osobi ili
 * doplatu po uzrastu. Godine dece se šalju pojedinačno, ne kao broj dece — dete od 3 i dete od
 * 14 godina nisu ista stavka (§2.4a).
 */
export async function ucitajKalendar(
  contractId: string,
  upit: { roomType: string; from: string; to: string; adults: number; childrenAges: number[] },
): Promise<{ podaci: unknown | null; error: string | null }> {
  const q = new URLSearchParams({
    roomType: upit.roomType,
    from: upit.from,
    to: upit.to,
    adults: String(upit.adults),
  });
  for (const g of upit.childrenAges) q.append('childrenAges', String(g));

  try {
    const podaci = await apiFetch(
      `/contracting/contracts/${contractId}/pricelist-calendar?${q.toString()}`,
    );
    return { podaci, error: null };
  } catch (err) {
    return { podaci: null, error: poruka(err, 'Kalendar nije mogao da se učita.') };
  }
}

/**
 * M3 spec §4.8 — izmena cenovnika rečima, priprema predloga.
 *
 * Ništa ne upisuje. Vraća isti spisak razlika koji daje i uvoz dokumenta (§2.11l), uz ono što je
 * model razumeo i ono što ovaj tok ne ume da primeni.
 */
export async function pripremiIzmenuRecima(
  contractId: string,
  telo: { instructionText: string; effectiveFrom: string },
): Promise<{ predlog: unknown | null; error: string | null }> {
  try {
    const predlog = await apiFetch(
      `/contracting/contracts/${contractId}/pricelist-versions/recima`,
      { method: 'POST', body: telo },
    );
    return { predlog, error: null };
  } catch (err) {
    return { predlog: null, error: poruka(err, 'Priprema izmene nije uspela.') };
  }
}

/**
 * Primena odobrenih razlika. Ide **istim** endpoint-om kao uvoz dokumenta — jedan put do upisa,
 * jedno mesto na kom se pravi verzija. `instructionText` se čuva uz nastalu verziju (§4.8.2).
 */
export async function primeniIzmeneRecima(
  contractId: string,
  telo: {
    effectiveFrom: string;
    redovi: unknown[];
    prihvaceniKljucevi: string[];
    instructionText: string;
  },
): Promise<Ishod> {
  try {
    await apiFetch(`/contracting/contracts/${contractId}/pricelist-versions/primeni`, {
      method: 'POST',
      body: telo,
    });
  } catch (err) {
    return { error: poruka(err, 'Primena izmena nije uspela.') };
  }
  revalidatePath(`/ugovori/${contractId}/cenovnik`);
  return { error: null };
}
