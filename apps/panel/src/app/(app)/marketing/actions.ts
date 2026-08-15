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

function strOrUndef(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

function tagsOrUndef(formData: FormData, key: string): string[] | undefined {
  const v = strOrUndef(formData, key);
  if (!v) return undefined;
  return v
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

// M12 spec §2.1/§7 — POST /content. generated_by je uvek HUMAN kroz ovaj ekran (AI nacrti
// nastaju isključivo kroz M2 product.published pretplatnika, §3).
export async function createContent(_prev: FormState, formData: FormData): Promise<FormState> {
  let content: { id: string };
  try {
    content = await apiFetch<{ id: string }>('/marketing/content', {
      method: 'POST',
      body: {
        productId: strOrUndef(formData, 'productId'),
        type: strOrUndef(formData, 'type'),
        slug: strOrUndef(formData, 'slug'),
        targetChannels: formData.getAll('targetChannels'),
        targetTags: tagsOrUndef(formData, 'targetTags'),
        containsAiGeneratedMedia: formData.get('containsAiGeneratedMedia') === 'on',
        scheduledPublishAt: strOrUndef(formData, 'scheduledPublishAt'),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje sadržaja nije uspelo.' };
  }
  revalidatePath('/marketing');
  redirect(`/marketing/${content.id}`);
}

// M12 spec §7 — PATCH /content/:id. Servis odbija izmenu APPROVED/PUBLISHED sadržaja (§3,
// nepovratna granica) — forma se u UI prikazuje samo dok je DRAFT/PENDING_APPROVAL.
export async function updateContent(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/marketing/content/${id}`, {
      method: 'PATCH',
      body: {
        slug: strOrUndef(formData, 'slug'),
        targetChannels: formData.getAll('targetChannels').length > 0 ? formData.getAll('targetChannels') : undefined,
        targetTags: tagsOrUndef(formData, 'targetTags'),
        containsAiGeneratedMedia: formData.get('containsAiGeneratedMedia') === 'on',
        scheduledPublishAt: strOrUndef(formData, 'scheduledPublishAt'),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Izmena sadržaja nije uspela.' };
  }
  revalidatePath(`/marketing/${id}`);
  revalidatePath('/marketing');
  return { error: null };
}

// M12 spec §3 korak 4/§7 — POST /content/:id/approve. Nepovratna granica ka javnoj objavi,
// nikad AI agent (M15 registar: content.approve_publish = PROPOSE_THEN_APPROVE, sprovedeno na
// nivou koda preko AgentActionGuard-a).
export async function approveContent(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/marketing/content/${id}/approve`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Odobravanje sadržaja nije uspelo.' };
  }
  revalidatePath(`/marketing/${id}`);
  revalidatePath('/marketing');
  return { error: null };
}

// M12 spec §2.2/§7 — PUT /content/:id/translations, isti obrazac kao M2 prevodi.
export async function upsertContentTranslation(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/marketing/content/${id}/translations`, {
      method: 'PUT',
      body: {
        languageCode: strOrUndef(formData, 'languageCode'),
        title: strOrUndef(formData, 'title'),
        body: strOrUndef(formData, 'body'),
        translationSource: 'MANUAL',
        isReviewed: formData.get('isReviewed') === 'on',
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Čuvanje prevoda nije uspelo.' };
  }
  revalidatePath(`/marketing/${id}`);
  return { error: null };
}

// M12 spec §4/§7 — POST /channels. Kredencijali (authConfig) se enkriptuju na backendu.
export async function createChannel(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch('/marketing/channels', {
      method: 'POST',
      body: {
        channelCode: strOrUndef(formData, 'channelCode'),
        displayName: strOrUndef(formData, 'displayName'),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje kanala nije uspelo.' };
  }
  revalidatePath('/marketing/kanali');
  return { error: null };
}

// M12 spec §7 — PATCH /channels/:code.
export async function updateChannel(code: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/marketing/channels/${code}`, {
      method: 'PATCH',
      body: {
        displayName: strOrUndef(formData, 'displayName'),
        status: strOrUndef(formData, 'status'),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Izmena kanala nije uspela.' };
  }
  revalidatePath('/marketing/kanali');
  return { error: null };
}
