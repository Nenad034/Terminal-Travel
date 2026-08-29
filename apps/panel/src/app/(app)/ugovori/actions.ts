'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api-client';
import type { AgePolicyOverrideEntry } from './[id]/PeriodsPanel';

export interface FormState {
  error: string | null;
}

// M3 spec §2.3/§2.3b — POST /contracting/contracts/:id/periods odbija period koji se datumski
// preklapa sa postojećim za isti room_type (overlap.ts) — greška se prosleđuje kao i svaka druga.
export async function createPeriod(contractId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const allotmentMode = String(formData.get('allotmentMode'));
  try {
    const agePolicyRaw = String(formData.get('agePolicyOverride') ?? '');
    let agePolicyOverride: AgePolicyOverrideEntry[] | undefined;
    if (agePolicyRaw.trim()) {
      agePolicyOverride = JSON.parse(agePolicyRaw);
    }
    await apiFetch(`/contracting/contracts/${contractId}/periods`, {
      method: 'POST',
      body: {
        stayFrom: formData.get('stayFrom'),
        stayTo: formData.get('stayTo'),
        roomType: formData.get('roomType'),
        allotmentMode,
        totalCapacity: allotmentMode !== 'ON_REQUEST' ? Number(formData.get('totalCapacity')) : undefined,
        releaseDaysBefore: allotmentMode === 'FIXED' && formData.get('releaseDaysBefore') ? Number(formData.get('releaseDaysBefore')) : undefined,
        ukupnaFiksnaObaveza:
          allotmentMode === 'CHARTER' || allotmentMode === 'FIXED_LEASE' ? Number(formData.get('ukupnaFiksnaObaveza')) : undefined,
        fixedObligationCurrency: allotmentMode === 'CHARTER' || allotmentMode === 'FIXED_LEASE' ? formData.get('fixedObligationCurrency') : undefined,
        agePolicyOverride,
      },
    });
    revalidatePath(`/ugovori/${contractId}`);
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje perioda nije uspelo.' };
  }
  return { error: null };
}

export async function addRateLine(contractId: string, periodId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/contracting/contracts/${contractId}/periods/${periodId}/rates`, {
      method: 'PUT',
      body: {
        boardType: formData.get('boardType'),
        occupancy: formData.get('occupancy'),
        priceBasis: formData.get('priceBasis'),
        price: Number(formData.get('price')),
        cribFeePerNight: formData.get('cribFeePerNight') ? Number(formData.get('cribFeePerNight')) : undefined,
      },
    });
    revalidatePath(`/ugovori/${contractId}/periods/${periodId}`);
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Dodavanje cenovne stavke nije uspelo.' };
  }
  return { error: null };
}

export async function addCancellationRule(contractId: string, periodId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/contracting/contracts/${contractId}/periods/${periodId}/cancellation-rules`, {
      method: 'PUT',
      body: {
        daysBeforeStay: Number(formData.get('daysBeforeStay')),
        refundPercentage: Number(formData.get('refundPercentage')),
      },
    });
    revalidatePath(`/ugovori/${contractId}/periods/${periodId}`);
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Dodavanje pravila otkazivanja nije uspelo.' };
  }
  return { error: null };
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}
