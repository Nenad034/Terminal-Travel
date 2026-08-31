import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';

// M12 spec §2.5/§7 (23.8.2026) — isti obrazac kao M19 `/api/chat/attachments/[attachmentId]`:
// preuzimanje se provlači kroz panel server, M1 pristupni token nikad ne ide klijentu.
export async function GET(_req: NextRequest, props: { params: Promise<{ mediaId: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Nema aktivne sesije' }, { status: 401 });

  const res = await fetch(`${API_BASE_URL}/marketing/content/media/${params.mediaId}/download`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });

  if (!res.ok || !res.body) {
    return NextResponse.json({ message: 'Medija nije pronađena.' }, { status: res.status || 404 });
  }

  // Namerno BEZ `content-disposition` (za razliku od M19 attachment proxy-ja) — ovo se koristi kao
  // `<img src>`/`<video src>` u galeriji (MediaGallery.tsx), ne kao dugme "preuzmi". API
  // `res.download()` postavlja `Content-Disposition: attachment`, što neki pregledači tumače
  // doslovno i ODBIJU da prikažu ugrađenu sliku/video — zadržavamo samo `content-type` da
  // prikaz uvek radi inline.
  const headers = new Headers();
  const contentType = res.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  return new NextResponse(res.body, { status: 200, headers });
}
