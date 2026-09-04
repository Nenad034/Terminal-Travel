import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M1 spec §5/§6 — POST /iam/auth/activate (javan, nosi jednokratan token u telu). Namerno
// NE upisuje sesijski kolačić: aktivacija samo postavlja lozinku, a prijava je poseban korak
// koji za interne uloge uvek prolazi kroz 2FA (M17 spec §3). Nalog bi inače dobio pristup
// panelu bez ijednog drugog faktora, čime bi obavezna 2FA bila zaobiđena na dan otvaranja.
export async function POST(req: NextRequest) {
  const { token, newPassword } = await req.json();

  try {
    await apiFetch('/iam/auth/activate', {
      method: 'POST',
      body: { token, newPassword },
      auth: false,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Aktivacija nije uspela' }, { status: err.status });
    }
    throw err;
  }
}
