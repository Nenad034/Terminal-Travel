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

// M21 spec §2.1/§6 — POST /help/articles. Uvek DRAFT, generated_by=HUMAN kroz ovaj ekran (AI
// nacrti nastaju isključivo kroz HelpArticleSuggestion.approve, §5.4).
export async function createArticle(_prev: FormState, formData: FormData): Promise<FormState> {
  let article: { id: string };
  try {
    article = await apiFetch<{ id: string }>('/help/articles', {
      method: 'POST',
      body: {
        slug: strOrUndef(formData, 'slug'),
        audience: formData.getAll('audience'),
        relatedModule: strOrUndef(formData, 'relatedModule'),
        isCriticalExample: formData.get('isCriticalExample') === 'on',
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje članka nije uspelo.' };
  }
  revalidatePath('/pomoc');
  redirect(`/pomoc/${article.id}`);
}

// M21 spec §6 — PATCH /help/articles/:id, prelazak statusa BEZ objave (DRAFT/PENDING_APPROVAL/
// ARCHIVED — objava ide isključivo kroz publishArticle ispod, poseban PUBLISH gate).
export async function updateArticleStatus(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/help/articles/${id}`, {
      method: 'PATCH',
      body: { status: strOrUndef(formData, 'status') },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Izmena statusa nije uspela.' };
  }
  revalidatePath(`/pomoc/${id}`);
  revalidatePath('/pomoc');
  return { error: null };
}

// M21 spec §2.1/§6 — PATCH /help/articles/:id sa status=PUBLISHED. Zahteva PUBLISH dozvolu
// (Direktor/Vlasnik, §3/§8) i backend automatski popunjava approved_by — nikad se ne šalje
// kroz telo, nikad AI. Nepovratna granica, sopstveno dugme (isti princip kao M12 approveContent).
export async function publishArticle(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/help/articles/${id}`, { method: 'PATCH', body: { status: 'PUBLISHED' } });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Objavljivanje nije uspelo.' };
  }
  revalidatePath(`/pomoc/${id}`);
  revalidatePath('/pomoc');
  return { error: null };
}

// M21 spec §2.2/§6 — PUT /help/articles/:id/translations, isti obrazac kao M2/M12 prevodi.
export async function upsertArticleTranslation(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/help/articles/${id}/translations`, {
      method: 'PUT',
      body: {
        languageCode: strOrUndef(formData, 'languageCode'),
        title: strOrUndef(formData, 'title'),
        body: strOrUndef(formData, 'body'),
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Čuvanje prevoda nije uspelo.' };
  }
  revalidatePath(`/pomoc/${id}`);
  return { error: null };
}

// M21 spec §5.4/§6 — PATCH /help/suggestions/:id. APPROVE kreira HelpArticle(PENDING_APPROVAL)
// koji i dalje čeka sopstveni korak objavljivanja (publishArticle iznad) — dva odvojena koraka.
export async function reviewSuggestion(id: string, decision: 'APPROVE' | 'REJECT', _prev: FormState, _formData: FormData): Promise<FormState> {
  let result: { createdArticle: { id: string } | null };
  try {
    result = await apiFetch(`/help/suggestions/${id}`, { method: 'PATCH', body: { decision } });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Obrada predloga nije uspela.' };
  }
  revalidatePath('/pomoc/predlozi');
  if (result.createdArticle) {
    redirect(`/pomoc/${result.createdArticle.id}`);
  }
  return { error: null };
}
