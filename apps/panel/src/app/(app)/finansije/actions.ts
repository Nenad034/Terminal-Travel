'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';

export interface FormState {
  error: string | null;
}

// M10 spec §6 korak 1 — priprema nacrta je nivo "Autonomno" (nulti rizik, ništa još nije
// poslato spolja) i idempotentna (vraća postojeći dokument ako već postoji, nikad duplikat) —
// bezbedno kao "prikaži/pripremi" dugme koje Računovođa svesno klikne sa stranice rezervacije.
export async function prepareFiscalDocument(bookingId: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  let documentId: string;
  try {
    const doc = await apiFetch<{ id: string }>('/finance/fiscal-documents/draft', { method: 'POST', body: { bookingId } });
    documentId = doc.id;
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Priprema fiskalnog dokumenta nije uspela.' };
  }
  redirect(`/finansije/fiskalni-dokumenti/${documentId}`);
}

// M10 spec §6 korak 2 — SLANJE je isključivo ljudska radnja ("Nikad autonomno" iz poglavlja 7
// Master dokumenta), nepovratan korak (kreira pravni dokument kod SEF/ESIR). Dozvola
// M10/fiscal-document/SUBMIT sprovedena na nivou API-ja, ovde samo eksplicitan klik.
export async function submitFiscalDocument(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/finance/fiscal-documents/${id}/submit`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Slanje fiskalnog dokumenta nije uspelo.' };
  }
  revalidatePath(`/finansije/fiskalni-dokumenti/${id}`);
  return { error: null };
}

// M10 spec §6.1 — storno poslatog dokumenta, ide kroz isti SEF/ESIR sistem.
export async function stornoFiscalDocument(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/finance/fiscal-documents/${id}/storno`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Storniranje nije uspelo.' };
  }
  revalidatePath(`/finansije/fiskalni-dokumenti/${id}`);
  return { error: null };
}

// M10 spec §5.2/§9 — ručan unos prijema uplate (BANK_TRANSFER/CASH/CARD_MANUAL/CHECK/
// ADMINISTRATIVE_BAN), dozvola M10/payment/RECORD. Dopuna (2.9.2026, na zahtev vlasnika):
// BANK_TRANSFER/CARD_MANUAL nose `bankId`; CHECK nosi `checkDetails` (specifikacija čekova) —
// tri paralelna niza istog indeksa iz repeatable redova forme (`checkBankId[]`/`checkAmount[]`/
// itd.), spojena ovde u niz objekata pre slanja API-ju.
export async function recordPayment(bookingId: string, redirectTo: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const method = String(formData.get('method') ?? '');
  const bankIds = formData.getAll('checkBankId').map(String);
  const amounts = formData.getAll('checkAmount').map(String);
  const numbers = formData.getAll('checkNumber').map(String);
  const dates = formData.getAll('checkClearanceDate').map(String);
  const checkDetails = bankIds.map((bankId, i) => ({
    bankId,
    amount: Math.round(Number(amounts[i]) * 100),
    checkNumber: numbers[i],
    clearanceDate: dates[i],
  }));

  try {
    await apiFetch('/finance/payments', {
      method: 'POST',
      body: {
        bookingId,
        amount: Math.round(Number(formData.get('amount')) * 100),
        currency: formData.get('currency'),
        method,
        reference: formData.get('reference') || undefined,
        ...((method === 'BANK_TRANSFER' || method === 'CARD_MANUAL') && formData.get('bankId') ? { bankId: formData.get('bankId') } : {}),
        ...(method === 'CHECK' ? { checkDetails } : {}),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Beleženje uplate nije uspelo.' };
  }
  revalidatePath(redirectTo);
  revalidatePath('/finansije');
  return { error: null };
}

// M10 spec §5.2 dopuna (2.9.2026, na zahtev vlasnika) — korekcija već unete uplate (npr. greška
// pri kucanju specifikacije čekova); API blokira kad je za rezervaciju fiskalni dokument već
// SUBMITTED/ISSUED ili kad je uplata CARD (webhook tok) — ovde samo prenos forme, isti oblik
// polja kao `recordPayment`.
export async function updatePayment(paymentId: string, redirectTo: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const method = String(formData.get('method') ?? '');
  const bankIds = formData.getAll('checkBankId').map(String);
  const amounts = formData.getAll('checkAmount').map(String);
  const numbers = formData.getAll('checkNumber').map(String);
  const dates = formData.getAll('checkClearanceDate').map(String);
  const checkDetails = bankIds.map((bankId, i) => ({
    bankId,
    amount: Math.round(Number(amounts[i]) * 100),
    checkNumber: numbers[i],
    clearanceDate: dates[i],
  }));

  try {
    await apiFetch(`/finance/payments/${paymentId}`, {
      method: 'PATCH',
      body: {
        amount: Math.round(Number(formData.get('amount')) * 100),
        currency: formData.get('currency'),
        method,
        reference: formData.get('reference') || undefined,
        ...((method === 'BANK_TRANSFER' || method === 'CARD_MANUAL') && formData.get('bankId') ? { bankId: formData.get('bankId') } : {}),
        ...(method === 'CHECK' ? { checkDetails } : {}),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Izmena uplate nije uspela.' };
  }
  revalidatePath(redirectTo);
  revalidatePath('/finansije');
  return { error: null };
}

// M10 spec §8.3 — prelazak u APPROVED je ljudska radnja, dozvola M10/supplier-obligation/APPROVE.
export async function approveSupplierObligation(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/finance/supplier-obligations/${id}/approve`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Odobravanje obaveze nije uspelo.' };
  }
  revalidatePath('/finansije');
  return { error: null };
}

// M10 spec §8.1 — beleži plaćanje dobavljaču, dozvola M10/supplier-obligation/APPROVE.
export async function paySupplierObligation(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/finance/supplier-obligations/${id}/pay`, { method: 'POST', body: {} });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Beleženje plaćanja dobavljaču nije uspelo.' };
  }
  revalidatePath('/finansije');
  return { error: null };
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}
