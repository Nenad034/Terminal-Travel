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

function strOrUndef(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

// M18 spec §4/§9 — POST /ops/weekly-reviews/run, dozvola M18/weekly-review/VIEW (isti
// ugovor kao GET — ručno pokretanje van rasporeda, uvek "SENT", isti sažetak kao ponedeljni
// cron, spec §4.1).
export async function runWeeklyReview(_prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch('/ops/weekly-reviews/run', { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Pokretanje nedeljnog pregleda nije uspelo.' };
  }
  revalidatePath('/nadzor');
  return { error: null };
}

// M18 spec §3/§9 — POST /ops/notification-channels. Konfiguracija zavisi od channelType
// (TELEGRAM: chatId, EMAIL: email adresa) — servis enkriptuje config_encrypted, ovaj ekran
// ga nikad ne prikazuje unazad (isti princip kao M4/M12 ProviderConfig/authConfig).
export async function createNotificationChannel(_prev: FormState, formData: FormData): Promise<FormState> {
  const channelType = strOrUndef(formData, 'channelType');
  const configValue = strOrUndef(formData, 'configValue');
  const config = channelType === 'TELEGRAM' ? { chatId: configValue } : { email: configValue };
  try {
    await apiFetch('/ops/notification-channels', {
      method: 'POST',
      body: {
        channelType,
        config,
        recipientRole: strOrUndef(formData, 'recipientRole'),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje kanala obaveštenja nije uspelo.' };
  }
  revalidatePath('/nadzor/kanali');
  return { error: null };
}

// M18 spec §3/§9 — PATCH /ops/notification-channels/:id, jedino izmenljivo polje sa ovog
// ekrana je status (ACTIVE/INACTIVE) — config se ne menja preko forme (spec §3 napomena,
// isti princip kao M4/M12).
export async function updateNotificationChannelStatus(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/ops/notification-channels/${id}`, {
      method: 'PATCH',
      body: { status: strOrUndef(formData, 'status') },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Izmena kanala obaveštenja nije uspela.' };
  }
  revalidatePath('/nadzor/kanali');
  return { error: null };
}

// M18 spec §5/§9 — POST /ops/trend-suggestions/:id/approve, dozvola M18/trend-suggestion/APPROVE.
// Samo za DRAFT (servis odbija ostalo, spec §10 izlazni kriterijum).
export async function approveTrendSuggestion(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/ops/trend-suggestions/${id}/approve`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Odobravanje predloga nije uspelo.' };
  }
  revalidatePath('/nadzor/trendovi');
  return { error: null };
}

// M18 spec §5/§9 — POST /ops/trend-suggestions/:id/reject, ista dozvola kao odobravanje.
export async function rejectTrendSuggestion(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/ops/trend-suggestions/${id}/reject`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Odbijanje predloga nije uspelo.' };
  }
  revalidatePath('/nadzor/trendovi');
  return { error: null };
}

// M18 spec §6.5/§9 — POST /ops/ai-provider-quota/:id/override, dozvola
// M18/ai-provider-quota/OVERRIDE. Ručan povratak iz DEGRADED u NORMAL pre isteka perioda,
// upisuje AuditLogEntry na backendu (M1) — ovaj ekran samo šalje zahtev.
export async function overrideAiProviderQuota(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/ops/ai-provider-quota/${id}/override`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Ručni povratak na NORMAL nije uspeo.' };
  }
  revalidatePath('/nadzor/ai-troskovi');
  return { error: null };
}
