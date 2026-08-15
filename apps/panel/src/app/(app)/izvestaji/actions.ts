'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api-client';

export interface FormState {
  error: string | null;
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}

// M13 spec §7 — POST /bi/reconciliation/run, ručno pokretanje van noćnog rasporeda
// (Vlasnik/Direktor). Gejtovano sa M13/report:profitability/VIEW na kontroleru (nema
// poseban ključ dozvole, isti krug uloga — vidi reconciliation.controller.ts).
export async function runReconciliation(_prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch('/bi/reconciliation/run', { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Rekonsilijacija nije uspela.' };
  }
  revalidatePath('/izvestaji');
  return { error: null };
}
