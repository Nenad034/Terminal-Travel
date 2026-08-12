import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';
import { setSession } from '@/lib/session';

// M1 spec §5/§6 — POST /iam/auth/register. Ovo je jedino mesto u M8 gde se M1 token
// direktno dobija i odmah upisuje u httpOnly kolačić (session.ts) — nikad ne ide klijentu.
export async function POST(req: NextRequest) {
  const dto = await req.json();

  try {
    const tokens = await apiFetch<{ accessToken: string; refreshToken: string }>('/iam/auth/register', {
      method: 'POST',
      body: dto,
      auth: false,
    });

    // Access token nosi samo user_id/session_id (M1 spec §3.7) — dekodiramo payload
    // (base64, bez verifikacije potpisa — API server je to već potpisao/proverio pri izdavanju)
    // samo da izvučemo user_id za session.ts, ne za autorizaciju.
    const payload = JSON.parse(Buffer.from(tokens.accessToken.split('.')[1], 'base64url').toString('utf8'));
    await setSession({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, userId: payload.sub });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Registracija nije uspela' }, { status: err.status });
    }
    throw err;
  }
}
