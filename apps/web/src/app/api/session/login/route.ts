import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';
import { setSession } from '@/lib/session';

// M1 spec §5 — POST /iam/auth/login. Gost sa uključenom 2FA (opciona za Gosta,
// M1 spec §5) dobija { requiresMfa, mfaToken } umesto tokena — taj slučaj se
// vraća klijentu kao poseban odgovor (MFA ekran je van obima ovog prvog prolaza
// M8 implementacije, pošto je 2FA za gosta opt-in i redak slučaj).
export async function POST(req: NextRequest) {
  const dto = await req.json();

  try {
    const result = await apiFetch<
      { requiresMfa: true; mfaToken: string } | { accessToken: string; refreshToken: string }
    >('/iam/auth/login', { method: 'POST', body: dto, auth: false });

    if ('requiresMfa' in result) {
      return NextResponse.json(result);
    }

    const payload = JSON.parse(Buffer.from(result.accessToken.split('.')[1], 'base64url').toString('utf8'));
    await setSession({ accessToken: result.accessToken, refreshToken: result.refreshToken, userId: payload.sub });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Prijava nije uspela' }, { status: err.status });
    }
    throw err;
  }
}
