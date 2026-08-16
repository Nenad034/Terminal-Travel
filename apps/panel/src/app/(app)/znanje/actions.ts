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

// M23 spec §2.1/§8 — POST /knowledge/articles. Telo grana na dva opciona puta: ručan unos
// (translations[]) ili AI istraživanje (research{}) — oba mogu izostati (prazan DRAFT). Za
// subjectType=PRODUCT dodatno kreira M2 ProductContentImport na backend-u (§4d), ova akcija
// ne dira M2 direktno.
export async function createArticle(_prev: FormState, formData: FormData): Promise<FormState> {
  const subjectType = strOrUndef(formData, 'subjectType');
  const mode = strOrUndef(formData, 'mode'); // 'manual' | 'research' | 'empty'

  const body: Record<string, unknown> = { subjectType };
  if (subjectType === 'PRODUCT') {
    body.productId = strOrUndef(formData, 'productId');
  } else {
    body.destinationCountry = strOrUndef(formData, 'destinationCountry');
    if (subjectType === 'DESTINATION') body.destinationCity = strOrUndef(formData, 'destinationCity');
  }

  if (mode === 'manual') {
    const title = strOrUndef(formData, 'title');
    const bodyText = strOrUndef(formData, 'body');
    const languageCode = strOrUndef(formData, 'languageCode') ?? 'sr';
    if (title && bodyText) {
      body.translations = [{ languageCode, title, body: bodyText, translationSource: 'MANUAL' }];
    }
  } else if (mode === 'research') {
    const sourceUrl = strOrUndef(formData, 'sourceUrl');
    const sourceType = strOrUndef(formData, 'sourceType');
    const rawText = strOrUndef(formData, 'rawText');
    if (sourceUrl && sourceType && rawText) {
      body.research = { sourceUrl, sourceType, rawText };
    }
  }

  let article: { id: string };
  try {
    article = await apiFetch<{ id: string }>('/knowledge/articles', { method: 'POST', body });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje članka nije uspelo.' };
  }
  revalidatePath('/znanje');
  redirect(`/znanje/${article.id}`);
}

// M23 spec §8 — PATCH /knowledge/articles/:id, prelaz statusa BEZ objave (DRAFT/PENDING_APPROVAL/
// ARCHIVED — PUBLISHED ide isključivo kroz publishArticle, poseban PUBLISH gate).
export async function updateArticleStatus(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/knowledge/articles/${id}`, { method: 'PATCH', body: { status: strOrUndef(formData, 'status') } });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Izmena statusa nije uspela.' };
  }
  revalidatePath(`/znanje/${id}`);
  revalidatePath('/znanje');
  return { error: null };
}

// M23 spec §2.1/§6/§8 — POST /knowledge/articles/:id/publish. Zahteva M23/article/PUBLISH,
// nikad actor_type=AI_AGENT (assertHumanActor, sprovedeno na nivou koda). Generiše share_token
// pri prvom prelasku u PUBLISHED.
export async function publishArticle(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/knowledge/articles/${id}/publish`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Objavljivanje nije uspelo.' };
  }
  revalidatePath(`/znanje/${id}`);
  revalidatePath('/znanje');
  return { error: null };
}

// M23 spec §2.3/§4a/§8 — POST /knowledge/articles/:id/sources. sourceType ograničen na tačno
// 3 dozvoljene vrednosti (nema OTHER/OTA/REVIEW_SITE opcije, sprovedeno i u <select> i u DTO-u).
export async function proposeSource(articleId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await apiFetch(`/knowledge/articles/${articleId}/sources`, {
      method: 'POST',
      body: { url: strOrUndef(formData, 'url'), sourceType: strOrUndef(formData, 'sourceType') },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Predlaganje izvora nije uspelo.' };
  }
  revalidatePath(`/znanje/${articleId}/izvori`);
  return { error: null };
}

// M23 spec §2.3/§4b/§8 — POST .../sources/:sourceId/approve|reject. Zahteva
// M23/article-source/APPROVE, nikad AI (assertHumanActor).
export async function reviewSource(
  articleId: string,
  sourceId: string,
  decision: 'approve' | 'reject',
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/knowledge/articles/${articleId}/sources/${sourceId}/${decision}`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Obrada izvora nije uspela.' };
  }
  revalidatePath(`/znanje/${articleId}/izvori`);
  revalidatePath(`/znanje/${articleId}/revizije`);
  return { error: null };
}

// M23 spec §2.4/§4c/§9 — POST .../revisions/:revisionId/approve|reject. approve zahteva da su
// SVI referencirani ArticleSource-ovi APPROVED (backend proverava, ne samo UI); nikad AI.
export async function reviewRevision(
  articleId: string,
  revisionId: string,
  decision: 'approve' | 'reject',
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/knowledge/articles/${articleId}/revisions/${revisionId}/${decision}`, { method: 'POST' });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Obrada revizije nije uspela.' };
  }
  revalidatePath(`/znanje/${articleId}/revizije`);
  revalidatePath(`/znanje/${articleId}`);
  revalidatePath('/znanje');
  return { error: null };
}
