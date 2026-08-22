import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';

// M19 spec §2.5/§8 (v1.6, 22.8.2026) — preuzimanje priloga se PROSLEĐUJE kroz panel server, ne
// vraća M1 pristupni token klijentu (za razliku od `/api/chat/ws-token`, koji to mora zbog WS
// handshake-a) — ovde nema takve potrebe, obična `<a href>` na ovu rutu je dovoljna, browser nikad
// ne vidi bearer token. API (`ConversationsService.getAttachmentForDownload`) i dalje sam proverava
// da je pozivalac učesnik razgovora kom prilog pripada — ova ruta samo prenosi Authorization
// zaglavlje sa servera, ne zaobilazi tu proveru.
export async function GET(_req: NextRequest, { params }: { params: { attachmentId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Nema aktivne sesije' }, { status: 401 });

  const res = await fetch(`${API_BASE_URL}/chat/conversations/attachments/${params.attachmentId}/download`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });

  if (!res.ok || !res.body) {
    return NextResponse.json({ message: 'Prilog nije pronađen.' }, { status: res.status || 404 });
  }

  const headers = new Headers();
  const contentType = res.headers.get('content-type');
  const contentDisposition = res.headers.get('content-disposition');
  if (contentType) headers.set('content-type', contentType);
  if (contentDisposition) headers.set('content-disposition', contentDisposition);

  return new NextResponse(res.body, { status: 200, headers });
}
