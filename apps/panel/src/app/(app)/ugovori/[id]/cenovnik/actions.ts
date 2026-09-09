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
