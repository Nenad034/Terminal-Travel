'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api-client';

// M5 spec §6/§6.4/§11 — otkazivanje i izmena rezervacije.
//
// Zašto je ovo poseban fajl akcija, a ne deo booking-ownership-actions.ts: prenos vlasništva
// menja KO vodi rezervaciju, ovo menja SAMU rezervaciju (kapacitet kod dobavljača, povraćaj,
// najava izmene). Nikad ne mešati u istu formu — isti princip kao M7 "odobri rabat" dugme.

export interface ChangeFormState {
  error: string | null;
  ok: string | null;
  /** §6.4 — API vratio upozorenje o mogućem duplikatu; otkazivanje NIJE izvršeno dok
   *  čovek eksplicitno ne potvrdi. Nikad se ne potvrđuje automatski. */
  duplicateWarning: {
    bookingItemId: string;
    conflictBookingNumber: string | null;
    conflictPaymentStatus: string | null;
    message: string;
  } | null;
}

export const emptyChangeState: ChangeFormState = { error: null, ok: null, duplicateWarning: null };

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
 *  za novi zahtev. Nova cena može biti različita; API je vraća, ekran je prikazuje. */
export async function modifyBookingItem(bookingId: string, _prev: ChangeFormState, formData: FormData): Promise<ChangeFormState> {
  const bookingItemId = String(formData.get('bookingItemId') ?? '');
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
      body: { bookingItemId, stayFrom, stayTo, occupancy: { adults, children } },
    });
  } catch (err) {
    return { ...emptyChangeState, error: err instanceof ApiError ? extractMessage(err) : 'Izmena nije uspela.' };
  }

  revalidatePath(`/rezervacije/${bookingId}`);
  return { ...emptyChangeState, ok: 'Izmena je izvršena — stara stavka je otkazana, nova je potvrđena.' };
}
