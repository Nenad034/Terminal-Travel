'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api-client';
import { ChangeFormState, emptyChangeState } from './change-form-state';

// M5 spec §6/§6.4/§11 — otkazivanje i izmena rezervacije.
//
// Zašto je ovo poseban fajl akcija, a ne deo booking-ownership-actions.ts: prenos vlasništva
// menja KO vodi rezervaciju, ovo menja SAMU rezervaciju (kapacitet kod dobavljača, povraćaj,
// najava izmene). Nikad ne mešati u istu formu — isti princip kao M7 "odobri rabat" dugme.
//
// `ChangeFormState`/`emptyChangeState` žive u `change-form-state.ts`, NE ovde — Next.js "use
// server" fajl sme da izvozi isključivo async funkcije; izvoz običnog objekta (bio je ovde do
// 2.9.2026) ruši build čim ga NOVA klijentska komponenta uveze (`AranzmanItemCard.tsx`):
// "A 'use server' file can only export async functions, found object."

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}

interface CancelResponse {
  duplicateWarning?: boolean;
  bookingItemId?: string;
  conflictBookingNumber?: string | null;
  conflictPaymentStatus?: string | null;
  message?: string;
}

/**
 * §6.4 tok u dva koraka: prvi poziv može da vrati upozorenje o duplikatu (HTTP 200, ne greška),
 * i tada NIŠTA nije otkazano. Tek ponovljen poziv sa `confirmDuplicateOverride` stvarno otkazuje.
 * `override` se prosleđuje samo kad ga je čovek kliknuo na upozorenju.
 */
export async function cancelBooking(bookingId: string, _prev: ChangeFormState, formData: FormData): Promise<ChangeFormState> {
  const reason = String(formData.get('reason') ?? '').trim();
  const override = formData.get('confirmDuplicateOverride') === 'true';
  const selected = formData.getAll('itemIds').map(String).filter(Boolean);

  if (!reason) return { ...emptyChangeState, error: 'Unesite razlog otkazivanja — ostaje trajno u istoriji rezervacije.' };

  try {
    const res = await apiFetch<CancelResponse>(`/sales/bookings/${bookingId}/cancel`, {
      method: 'POST',
      body: {
        reason,
        ...(selected.length > 0 ? { itemIds: selected } : {}),
        ...(override ? { confirmDuplicateOverride: true } : {}),
      },
    });

    if (res?.duplicateWarning) {
      return {
        error: null,
        ok: null,
        duplicateWarning: {
          bookingItemId: res.bookingItemId ?? '',
          conflictBookingNumber: res.conflictBookingNumber ?? null,
          conflictPaymentStatus: res.conflictPaymentStatus ?? null,
          message: res.message ?? 'Moguć duplikat rezervacije.',
        },
      };
    }
  } catch (err) {
    return { ...emptyChangeState, error: err instanceof ApiError ? extractMessage(err) : 'Otkazivanje nije uspelo.' };
  }

  revalidatePath(`/rezervacije/${bookingId}`);
  return { ...emptyChangeState, ok: 'Otkazivanje je izvršeno.' };
}

/** §6 — izmena se interno izvodi kao otkazivanje stare stavke + nova provera dostupnosti/cene
 *  za novi zahtev. Nova cena može biti različita; API je vraća, ekran je prikazuje. Dopuna
 *  (2.9.2026) — `productId` je opciono: prazno zadržava postojeću uslugu, popunjeno je menja
 *  (mora biti isti tip proizvoda, proverava API). */
export async function modifyBookingItem(bookingId: string, _prev: ChangeFormState, formData: FormData): Promise<ChangeFormState> {
  const bookingItemId = String(formData.get('bookingItemId') ?? '');
  const productId = String(formData.get('productId') ?? '').trim();
  const stayFrom = String(formData.get('stayFrom') ?? '');
  const stayTo = String(formData.get('stayTo') ?? '');
  const adults = Number(formData.get('adults') ?? 0);
  const children = Number(formData.get('children') ?? 0);

  if (!bookingItemId) return { ...emptyChangeState, error: 'Izaberite stavku koja se menja.' };
  if (!stayFrom || !stayTo) return { ...emptyChangeState, error: 'Unesite oba datuma.' };
  if (new Date(stayTo) <= new Date(stayFrom)) return { ...emptyChangeState, error: 'Datum završetka mora biti posle datuma početka.' };
  if (adults < 1) return { ...emptyChangeState, error: 'Mora postojati bar jedna odrasla osoba.' };

  try {
    await apiFetch(`/sales/bookings/${bookingId}/modify`, {
      method: 'POST',
      body: { bookingItemId, ...(productId ? { productId } : {}), stayFrom, stayTo, occupancy: { adults, children } },
    });
  } catch (err) {
    return { ...emptyChangeState, error: err instanceof ApiError ? extractMessage(err) : 'Izmena nije uspela.' };
  }

  revalidatePath(`/rezervacije/${bookingId}`);
  return { ...emptyChangeState, ok: 'Izmena je izvršena — stara stavka je otkazana, nova je potvrđena.' };
}

// Dopuna (2.9.2026, na zahtev vlasnika — kartica Aranžman: "promena usluge/datuma uz
// prethodnu proveru cene") — čist izračun, ništa ne menja; koristi se za "Proveri cenu" korak
// pre nego što čovek klikne stvarnu potvrdu (`modifyBookingItem` iznad). Obična async funkcija,
// ne `useActionState` reducer — poziva se iz `onClick`, ne iz `<form action>`, jer nema
// smisla da "provera" ostavi trag u istoriji forme.
export interface ModifyPreviewResult {
  error: string | null;
  currentPrice: number | null;
  currentCurrency: string | null;
  newPrice: number | null;
  newCurrency: string | null;
  priceDifference: number | null;
}

export async function previewModifyPrice(
  bookingId: string,
  input: { bookingItemId: string; productId?: string; stayFrom: string; stayTo: string; adults: number; children: number },
): Promise<ModifyPreviewResult> {
  const empty: ModifyPreviewResult = { error: null, currentPrice: null, currentCurrency: null, newPrice: null, newCurrency: null, priceDifference: null };
  if (!input.bookingItemId) return { ...empty, error: 'Izaberite stavku koja se menja.' };
  if (!input.stayFrom || !input.stayTo) return { ...empty, error: 'Unesite oba datuma.' };
  if (new Date(input.stayTo) <= new Date(input.stayFrom)) return { ...empty, error: 'Datum završetka mora biti posle datuma početka.' };

  try {
    const res = await apiFetch<{ currentPrice: number; currentCurrency: string; newPrice: number; newCurrency: string; priceDifference: number }>(
      `/sales/bookings/${bookingId}/modify/preview`,
      {
        method: 'POST',
        body: {
          bookingItemId: input.bookingItemId,
          ...(input.productId ? { productId: input.productId } : {}),
          stayFrom: input.stayFrom,
          stayTo: input.stayTo,
          occupancy: { adults: input.adults, children: input.children },
        },
      },
    );
    return { error: null, ...res };
  } catch (err) {
    return { ...empty, error: err instanceof ApiError ? extractMessage(err) : 'Provera cene nije uspela.' };
  }
}


// ============================================================================
// M5 spec §6.7 (3.9.2026, na zahtev vlasnika) — DODAVANJE usluge na rezervaciju
// ============================================================================
//
// Odvojeno od `modifyBookingItem` iznad iako liči: izmena ZAMENJUJE stavku (stara se otkazuje),
// dodavanje je samo dodaje. Spojene u jednu akciju, jedno "prazno polje" bi tiho odlučivalo da
// li se nešto otkazuje — najgora vrsta forme.

export interface AddItemPreviewResult {
  error: string | null;
  newPrice: number | null;
  newCurrency: string | null;
  bookingTotalBefore: number | null;
  bookingTotalAfter: number | null;
}

interface AddItemInput {
  productId: string;
  stayFrom: string;
  stayTo: string;
  adults: number;
  children: number;
}

/** Zajedničke provere pre slanja — iste za proveru cene i za stvarno dodavanje. */
function validateAddItem(input: AddItemInput): string | null {
  if (!input.productId) return 'Izaberite uslugu.';
  if (!input.stayFrom || !input.stayTo) return 'Unesite oba datuma.';
  if (new Date(input.stayTo) <= new Date(input.stayFrom)) return 'Datum završetka mora biti posle datuma početka.';
  if (input.adults < 1) return 'Mora postojati bar jedna odrasla osoba.';
  return null;
}

/** §6.7 korak 2 — "proveri cenu": ništa se ne rezerviše, samo se vidi šta bi ovo koštalo. */
export async function previewAddBookingItem(bookingId: string, input: AddItemInput): Promise<AddItemPreviewResult> {
  const empty: AddItemPreviewResult = { error: null, newPrice: null, newCurrency: null, bookingTotalBefore: null, bookingTotalAfter: null };
  const invalid = validateAddItem(input);
  if (invalid) return { ...empty, error: invalid };

  try {
    const res = await apiFetch<{ newPrice: number; newCurrency: string; bookingTotalBefore: number; bookingTotalAfter: number }>(
      `/sales/bookings/${bookingId}/items/preview`,
      {
        method: 'POST',
        body: { productId: input.productId, stayFrom: input.stayFrom, stayTo: input.stayTo, occupancy: { adults: input.adults, children: input.children } },
      },
    );
    return { error: null, ...res };
  } catch (err) {
    return { ...empty, error: err instanceof ApiError ? extractMessage(err) : 'Provera cene nije uspela.' };
  }
}

/** §6.7 korak 3 — stvarno dodavanje. Kapacitet kod dobavljača se uzima na serveru, pre upisa. */
export async function addBookingItem(bookingId: string, _prev: ChangeFormState, formData: FormData): Promise<ChangeFormState> {
  const input: AddItemInput = {
    productId: String(formData.get('productId') ?? '').trim(),
    stayFrom: String(formData.get('stayFrom') ?? ''),
    stayTo: String(formData.get('stayTo') ?? ''),
    adults: Number(formData.get('adults') ?? 0),
    children: Number(formData.get('children') ?? 0),
  };
  const invalid = validateAddItem(input);
  if (invalid) return { ...emptyChangeState, error: invalid };

  try {
    await apiFetch(`/sales/bookings/${bookingId}/items`, {
      method: 'POST',
      body: { productId: input.productId, stayFrom: input.stayFrom, stayTo: input.stayTo, occupancy: { adults: input.adults, children: input.children } },
    });
  } catch (err) {
    return { ...emptyChangeState, error: err instanceof ApiError ? extractMessage(err) : 'Dodavanje usluge nije uspelo.' };
  }

  revalidatePath(`/rezervacije/${bookingId}`);
  return { ...emptyChangeState, ok: 'Usluga je dodata — ukupno zaduženje je preračunato.' };
}


// ============================================================================
// M5 spec §6.7a — doplate i popusti kao VEZANE stavke
// ============================================================================

export interface AncillaryOption {
  id: string;
  name: string;
  kind: 'SURCHARGE' | 'DISCOUNT';
  priceBasis: string;
  payable: 'AGENCY' | 'ON_SITE';
  isMandatory: boolean;
  isRefundable: boolean;
  maxQuantity: number | null;
  notes: string | null;
  /** Iznos za TAČNO ovu stavku (njene noći, sobe, putnike) — popust je negativan. */
  amount: number;
  currency: string;
  alreadyAdded: boolean;
  /** Razlog zašto se ne može dodati (sastav gostiju), ili `null`. */
  blockedReason: string | null;
}

/** Spisak ugovorenih doplata/popusta za period matične stavke, sa već izračunatom cenom. */
export async function listItemAncillaries(bookingId: string, itemId: string): Promise<{ error: string | null; options: AncillaryOption[] }> {
  try {
    const options = await apiFetch<AncillaryOption[]>(`/sales/bookings/${bookingId}/items/${itemId}/ancillaries`);
    return { error: null, options };
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Spisak doplata nije dostupan.', options: [] };
  }
}

/** Dodaje opcionu doplatu/popust. Obavezne se povlače automatski i ne prolaze ovuda. */
export async function addAncillaryToItem(bookingId: string, itemId: string, ancillaryServiceId: string, quantity?: number): Promise<ChangeFormState> {
  try {
    await apiFetch(`/sales/bookings/${bookingId}/items/${itemId}/ancillaries`, {
      method: 'POST',
      body: { ancillaryServiceId, ...(quantity && quantity > 1 ? { quantity } : {}) },
    });
  } catch (err) {
    return { ...emptyChangeState, error: err instanceof ApiError ? extractMessage(err) : 'Dodavanje doplate nije uspelo.' };
  }
  revalidatePath(`/rezervacije/${bookingId}`);
  return { ...emptyChangeState, ok: 'Doplata je dodata.' };
}
