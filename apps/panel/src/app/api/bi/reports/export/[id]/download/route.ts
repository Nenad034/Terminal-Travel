import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';

// M13 spec §7 v1.5 — isti obrazac kao `bi-terminal/reports/[id]/download/route.ts` ("proslediti
// kroz panel server, nikad izložiti bearer token klijentu"), samo ka M13-ovoj sopstvenoj ruti.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Nema aktivne sesije' }, { status: 401 });

  const res = await fetch(`${API_BASE_URL}/bi/reports/export/${id}/download`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });

  if (!res.ok || !res.body) {
    return NextResponse.json({ message: 'Izveštaj je istekao ili ne postoji.' }, { status: res.status || 404 });
  }

  const headers = new Headers();
  const contentType = res.headers.get('content-type');
  const contentDisposition = res.headers.get('content-disposition');
  if (contentType) headers.set('content-type', contentType);
  if (contentDisposition) headers.set('content-disposition', contentDisposition);

  return new NextResponse(res.body, { status: 200, headers });
}
