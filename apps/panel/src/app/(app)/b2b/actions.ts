'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';

export interface FormState {
  error: string | null;
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}

function numOrUndef(formData: FormData, key: string): number | undefined {
  const v = formData.get(key);
  return typeof v === 'string' && v.trim() !== '' ? Number(v) : undefined;
}

function strOrUndef(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

// M7 spec §11 — POST /subagents. Uvek Tier 1 (parent_subagent_id null, popunjava se na
// backendu) — registraciju sub-subagenta radi isključivo roditeljski subagent kroz sopstveni
// portal (M7 spec §3/§6, van obima M17 — vidi napomenu u b2b/[id]/page.tsx).
export async function createSubagent(_prev: FormState, formData: FormData): Promise<FormState> {
  let subagent: { id: string };
  try {
    subagent = await apiFetch<{ id: string }>('/b2b/subagents', {
      method: 'POST',
      body: {
        clientAccountId: strOrUndef(formData, 'clientAccountId'),
        commissionPercentage: numOrUndef(formData, 'commissionPercentage'),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Registracija subagenta nije uspela.' };
  }
  revalidatePath('/b2b');
  redirect(`/b2b/${subagent.id}`);
}

// M7 spec §9/§11 — POST /subagents/:id/approve. Vlasnik/Direktor postavlja kreditni limit
// uvek, i proviziju samo ako je Tier 1 (backend to sprovodi — forma ovde šalje proviziju samo
// kad je vidljivo polje, backend ignoriše/zahteva u skladu sa §9).
export async function approveSubagent(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/b2b/subagents/${id}/approve`, {
      method: 'POST',
      body: {
        creditLimit: numOrUndef(formData, 'creditLimit'),
        creditLimitCurrency: strOrUndef(formData, 'creditLimitCurrency'),
        commissionPercentage: numOrUndef(formData, 'commissionPercentage'),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Odobravanje subagenta nije uspelo.' };
  }
  revalidatePath(`/b2b/${id}`);
  revalidatePath('/b2b');
  return { error: null };
}

// M7 spec §10 (M7/subagent/EDIT) — PATCH /subagents/:id, kreditni limit/status. commission_percentage
// se namerno ne menja odavde (§3 — Tier1 provizija se postavlja pri approve(), sub-subagent
// isključivo preko roditeljskog portala).
export async function updateSubagent(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/b2b/subagents/${id}`, {
      method: 'PATCH',
      body: {
        creditLimit: numOrUndef(formData, 'creditLimit'),
        creditLimitCurrency: strOrUndef(formData, 'creditLimitCurrency'),
        status: strOrUndef(formData, 'status'),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Izmena subagenta nije uspela.' };
  }
  revalidatePath(`/b2b/${id}`);
  revalidatePath('/b2b');
  return { error: null };
}

// M7 spec §3.1/§11 — POST /subagents/:id/volume-tiers. Isti autoritet kao osnovna provizija
// (agencija za Tier 1) — CommissionAuthorityService sprovodi na backendu.
export async function createVolumeTier(subagentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/b2b/subagents/${subagentId}/volume-tiers`, {
      method: 'POST',
      body: {
        rank: numOrUndef(formData, 'rank'),
        thresholdMetric: strOrUndef(formData, 'thresholdMetric'),
        thresholdPeriod: strOrUndef(formData, 'thresholdPeriod'),
        thresholdValue: numOrUndef(formData, 'thresholdValue'),
        resultingCommissionPercentage: numOrUndef(formData, 'resultingCommissionPercentage'),
        resultingCommissionFixedAmount: numOrUndef(formData, 'resultingCommissionFixedAmount'),
        resultingCommissionCurrency: strOrUndef(formData, 'resultingCommissionCurrency'),
        retroactive: formData.get('retroactive') === 'on',
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje praga obima nije uspelo.' };
  }
  revalidatePath(`/b2b/${subagentId}`);
  return { error: null };
}

// M7 spec §3.2/§11 — POST /subagents/:id/commission-rebates/:rebateId/approve. Ovo je
// eksplicitna, namerna ljudska radnja ("Predloži pa čovek odobri", M15 tier PROPOSE_THEN_APPROVE
// za commission_rebate.apply) — sopstveno dugme, nikad deo druge radnje/forme.
export async function approveRebate(subagentId: string, rebateId: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/b2b/subagents/${subagentId}/commission-rebates/${rebateId}/approve`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Odobravanje rabata nije uspelo.' };
  }
  revalidatePath(`/b2b/${subagentId}`);
  revalidatePath('/b2b/rabati');
  return { error: null };
}

// M7 spec §3.2/§11 — POST /subagents/:id/commission-rebates/:rebateId/reject, sa razlogom.
export async function rejectRebate(subagentId: string, rebateId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/b2b/subagents/${subagentId}/commission-rebates/${rebateId}/reject`, {
      method: 'POST',
      body: { reason: strOrUndef(formData, 'reason') ?? 'Bez navedenog razloga.' },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Odbijanje rabata nije uspelo.' };
  }
  revalidatePath(`/b2b/${subagentId}`);
  revalidatePath('/b2b/rabati');
  return { error: null };
}
