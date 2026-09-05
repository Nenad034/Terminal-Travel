'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api-client';
import type { FormState } from './types';

const PATH = '/rezervacije/najave';

// M5 spec §8.4/§8.8 — ekran „Najave dobavljačima" (5.9.2026, na zahtev vlasnika posle revizije
// koda: pozadinska logika je postojala od avgusta, ali nijedan ekran je nije pokretao, pa je
// operater praktično nije imao — „logika postoji, UI ne" iz CLAUDE.md).
//
// Sve tri akcije su ISKLJUČIVO ljudske (§8.4/§10): AI agent sme da pripremi nacrt, nikad da
// pošalje niti da upiše potvrdu dobavljača. Zato su ovo obične server akcije vezane za dugme,
// bez ijedne automatske putanje.

/** §8.4 — priprema nacrta za jednu rezervaciju; grupiše po dobavljaču sama. */
export async function prepareForBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  const bookingId = String(formData.get('bookingId') ?? '').trim();
  if (!bookingId) return { error: 'Unesite ID ili broj rezervacije.', notice: null };
  try {
    const drafts = await apiFetch<unknown[]>(`/sales/bookings/${bookingId}/prepare-supplier-manifests`, { method: 'POST' });
    revalidatePath(PATH);
    return {
      error: null,
      notice:
        drafts.length === 0
          ? 'Nema šta da se najavi — sve potvrđene stavke ove rezervacije su već na nekoj listi.'
          : `Pripremljeno nacrta: ${drafts.length}. Nijedan još nije poslat.`,
    };
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Priprema nacrta nije uspela.', notice: null };
  }
}

/**
 * §8.4 — slanje. Odgovor nosi status, pa se OVDE vidi razlika koju je uveo nalaz 1.2:
 * `SENT` znači da je poruka stvarno otišla, `PENDING_SEND` da je pokušaj zabeležen a isporuke
 * nije bilo. Ekran to kaže doslovno umesto da oba prikaže kao uspeh.
 */
export async function sendManifest(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    const updated = await apiFetch<{ status: string; sentToEmail: string | null }>(`/sales/supplier-manifests/${id}/send`, { method: 'POST' });
    revalidatePath(PATH);
    return updated.status === 'SENT'
      ? { error: null, notice: `Poslato na ${updated.sentToEmail ?? 'adresu dobavljača'}.` }
      : { error: null, notice: 'Pokušaj je zabeležen, ali poruka NIJE otišla — lista čeka slanje. Pokušajte ponovo kad pošta proradi.' };
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Slanje nije uspelo.', notice: null };
  }
}

/** §8.6 — potvrda dobavljača ISKLJUČIVO ljudskim klikom, nikad automatski, ma koliko AI bio siguran. */
export async function confirmManifest(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/sales/supplier-manifests/${id}/confirm-supplier`, { method: 'POST' });
    revalidatePath(PATH);
    return { error: null, notice: 'Upisana potvrda dobavljača.' };
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Upis potvrde nije uspeo.', notice: null };
  }
}

/** §8.8 — izmena/storno; adresa dobavljača dolazi sa samog zapisa, operater je ne prekucava. */
export async function sendChangeNotice(id: string, supplierEmail: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  if (!supplierEmail) return { error: 'Za ovu stavku nije poznata adresa dobavljača.', notice: null };
  try {
    const updated = await apiFetch<{ status: string }>(`/sales/supplier-change-notices/${id}/send`, {
      method: 'POST',
      body: { supplierEmail },
    });
    revalidatePath(PATH);
    return updated.status === 'SENT'
      ? { error: null, notice: `Poslato na ${supplierEmail}.` }
      : { error: null, notice: 'Pokušaj je zabeležen, ali poruka NIJE otišla — čeka slanje.' };
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Slanje nije uspelo.', notice: null };
  }
}

export async function confirmChangeNotice(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/sales/supplier-change-notices/${id}/confirm-supplier`, { method: 'POST' });
    revalidatePath(PATH);
    return { error: null, notice: 'Upisana potvrda dobavljača.' };
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Upis potvrde nije uspeo.', notice: null };
  }
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | undefined;
  const message = body?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? 'Zahtev nije uspeo.';
}
