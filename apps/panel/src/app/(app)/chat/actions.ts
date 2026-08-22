'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, apiFetchMultipart, ApiError } from '@/lib/api-client';

export interface FormState {
  error: string | null;
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}

// M19 spec §2.1/§8 — POST /chat/conversations. DIRECT prihvata tačno jednog drugog učesnika,
// GROUP jednog ili više + naziv (servis to proverava, ova akcija samo prosleđuje formu).
export async function createConversation(_prev: FormState, formData: FormData): Promise<FormState> {
  const type = formData.get('type') === 'GROUP' ? 'GROUP' : 'DIRECT';
  const participantUserIds = formData.getAll('participantUserIds').filter((v) => typeof v === 'string' && v) as string[];
  const name = formData.get('name');

  let conversation: { id: string };
  try {
    conversation = await apiFetch<{ id: string }>('/chat/conversations', {
      method: 'POST',
      body: {
        type,
        name: type === 'GROUP' && typeof name === 'string' && name.trim() !== '' ? name.trim() : undefined,
        participantUserIds,
      },
    });
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje razgovora nije uspelo.' };
  }
  revalidatePath('/chat');
  redirect(`/chat/${conversation.id}`);
}

// §8 — POST /chat/conversations/:id/read. Poziva se pri otvaranju razgovora i ovde (server
// akcija) da lista na /chat prikaže tačno stanje nepročitanih odmah posle SSR revalidacije,
// dodatno ChatPanel.tsx (klijent) zove istu putanju preko fetch-a za live ažuriranje bez reload-a.
export async function markConversationRead(conversationId: string): Promise<void> {
  try {
    await apiFetch(`/chat/conversations/${conversationId}/read`, { method: 'POST' });
  } catch {
    // best-effort — nepročitano stanje nije kritično ako poziv ne uspe
  }
  revalidatePath('/chat');
}

// §3/§8 — REST fallback za slanje poruke, korišćen u ChatPanel.tsx SAMO kada WS konekcija nije
// uspostavljena (spec §3 "nema gubitka poruka" — poruka se ipak čuva i isporučuje pri sledećem
// povezivanju primaoca). Primarni put je WS `message.send` (§8), koji uživo emituje `message.new`
// svim povezanim učesnicima — ovaj REST put to NE radi (samo eventBus interno), pa ga koristimo
// isključivo kao pouzdan fallback, ne kao normalan put slanja.
//
// `file` (§2.5, v1.6) — prilog uz poruku UVEK ide ovim putem, čak i kad je WS povezan: socket.io
// payload je JSON, ne nosi binarni fajl, a dodavanje posebnog binarnog WS kanala je van obima
// ovog prolaza (postojeći REST endpoint već prima `multipart/form-data`, poglavlje 8 M19 spec).
export async function sendMessageRestFallback(
  conversationId: string,
  body: string,
  draftedByAi = false,
  file?: File,
): Promise<{ error: string | null; message?: unknown }> {
  try {
    let message: unknown;
    if (file) {
      const formData = new FormData();
      if (body) formData.set('body', body);
      if (draftedByAi) formData.set('draftedByAi', 'true');
      formData.set('file', file);
      message = await apiFetchMultipart(`/chat/conversations/${conversationId}/messages`, formData);
    } else {
      message = await apiFetch(`/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { body, draftedByAi: draftedByAi || undefined },
      });
    }
    revalidatePath(`/chat/${conversationId}`);
    return { error: null, message };
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Slanje poruke nije uspelo.' };
  }
}

// §9.5/§9.7 — POST /chat/supplier-conversations/:id/draft-reply. Vraća ISKLJUČIVO tekst; nijedan
// put odavde ne šalje poruku (to je sama sprovedba pravila "Predloži pa čovek odobri"). Zaposleni
// dobijeni tekst pregleda, po potrebi izmeni, i sam pritisne "pošalji" — tek tada se, po §2.3,
// beleži da je tekst potekao iz AI nacrta.
export async function draftSupplierReply(
  conversationId: string,
  instruction: string,
): Promise<{ draft: string | null; note?: string; error: string | null }> {
  try {
    const result = await apiFetch<{ draft: string | null; note?: string }>(
      `/chat/supplier-conversations/${conversationId}/draft-reply`,
      { method: 'POST', body: { instruction: instruction.trim() || undefined } },
    );
    return { ...result, error: null };
  } catch (err) {
    return { draft: null, error: err instanceof ApiError ? extractMessage(err) : 'AI nacrt nije uspeo.' };
  }
}
