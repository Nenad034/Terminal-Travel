import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M1 spec §5/§6 — POST /iam/auth/password/reset (javan, nosi jednokratan token u telu).
// Kao i aktivacija: NE upisuje sesijski kolačić. Promena lozinke opoziva sve postojeće sesije,
// pa se korisnik posle prijavljuje iznova — kroz 2FA, kao i uvek za internu ulogu.
export async function POST(req: NextRequest) {
  const { token, newPassword } = await req.json();

  try {
    await apiFetch('/iam/auth/password/reset', { method: 'POST', body: { token, newPassword }, auth: false });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Promena lozinke nije uspela' }, { status: err.status });
    }
    throw err;
  }
}
