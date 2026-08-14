import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';
import { setSession } from '@/lib/session';

// M1 spec §5/§6 — POST /iam/auth/mfa/verify, drugi korak prijave. M17 spec §3: "obavezna
// 2FA za sve interne uloge" — ovaj korak je uvek deo prijave na panel (za razliku od M8
// gde je opciona za Gosta i ostavljena van obima prvog prolaza).
export async function POST(req: NextRequest) {
  const { mfaToken, code } = await req.json();

  try {
    const result = await apiFetch<{ accessToken: string; refreshToken: string }>('/iam/auth/mfa/verify', {
      method: 'POST',
      body: { mfaToken, code },
      auth: false,
    });

    const payload = JSON.parse(Buffer.from(result.accessToken.split('.')[1], 'base64url').toString('utf8'));
    await setSession({ accessToken: result.accessToken, refreshToken: result.refreshToken, userId: payload.sub });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Neispravan MFA kod' }, { status: err.status });
    }
    throw err;
  }
}
