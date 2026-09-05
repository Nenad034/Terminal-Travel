import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M13 spec §7 v1.5 — tanak posrednik ka `POST /bi/reports/export` (isti "klijent ne sme da vidi
// JWT" obrazac kao ostale BFF rute, npr. `bi-terminal/reports/[id]/send-chat`). Telo (`reportKind`/
// `title`/`format`/`rows`/`imageBase64`) prosleđuje se nepromenjeno — validacija je na API strani
// (`ExportReportDto`), ovaj sloj je čist prolaz.
export async function POST(req: NextRequest) {
  const dto = await req.json();
  try {
    const result = await apiFetch('/bi/reports/export', { method: 'POST', body: dto, requireAuth: true });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Izvoz izveštaja nije uspeo' }, { status: err.status });
    }
    throw err;
  }
}
