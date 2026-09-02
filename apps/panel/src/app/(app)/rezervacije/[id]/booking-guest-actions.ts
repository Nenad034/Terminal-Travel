'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api-client';
import { GuestCrudFormState } from './guest-crud-form-state';

// M5 spec §4.3 dopuna (2.9.2026, na zahtev vlasnika: "u tabu Putnici treba omogućiti dodavanje
// i brisanje putnika i vršiti izmene u vezi podataka putnika — ovo nema veze sa profilom
// putnika") — menja ISKLJUČIVO M5 `BookingItemGuest.guestFirstName`/`guestLastName`, nikad M6
// `GuestProfile` (dokument/državljanstvo/datum rođenja ostaju netaknuti, uređuju se u M6).

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}

export async function addBookingGuest(bookingId: string, bookingItemId: string, _prev: GuestCrudFormState, formData: FormData): Promise<GuestCrudFormState> {
  const guestFirstName = String(formData.get('guestFirstName') ?? '').trim();
  const guestLastName = String(formData.get('guestLastName') ?? '').trim();
  if (!guestFirstName || !guestLastName) return { error: 'Unesite ime i prezime.', ok: null };

  try {
    await apiFetch(`/sales/bookings/items/${bookingItemId}/guests`, { method: 'POST', body: { guestFirstName, guestLastName } });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Dodavanje putnika nije uspelo.', ok: null };
  }
  revalidatePath(`/rezervacije/${bookingId}`);
  return { error: null, ok: 'Putnik je dodat.' };
}

export async function updateBookingGuest(
  bookingId: string,
  bookingItemId: string,
  guestId: string,
  _prev: GuestCrudFormState,
  formData: FormData,
): Promise<GuestCrudFormState> {
  const guestFirstName = String(formData.get('guestFirstName') ?? '').trim();
  const guestLastName = String(formData.get('guestLastName') ?? '').trim();
  if (!guestFirstName || !guestLastName) return { error: 'Unesite ime i prezime.', ok: null };

  try {
    await apiFetch(`/sales/bookings/items/${bookingItemId}/guests/${guestId}`, { method: 'PATCH', body: { guestFirstName, guestLastName } });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Izmena podataka putnika nije uspela.', ok: null };
  }
  revalidatePath(`/rezervacije/${bookingId}`);
  return { error: null, ok: 'Podaci putnika su izmenjeni.' };
}

export async function deleteBookingGuest(
  bookingId: string,
  bookingItemId: string,
  guestId: string,
  _prev: GuestCrudFormState,
  _formData: FormData,
): Promise<GuestCrudFormState> {
  try {
    await apiFetch(`/sales/bookings/items/${bookingItemId}/guests/${guestId}`, { method: 'DELETE' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Brisanje putnika nije uspelo.', ok: null };
  }
  revalidatePath(`/rezervacije/${bookingId}`);
  return { error: null, ok: 'Putnik je uklonjen.' };
}
