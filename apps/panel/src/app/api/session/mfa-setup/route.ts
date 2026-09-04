import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';
import { setSession } from '@/lib/session';

// M1 spec §5/§6/§7 (dopuna 4.9.2026) — treći korak prijave: PRVO podešavanje obavezne 2FA.
// `setupToken` stiže iz odgovora na /iam/auth/login kad je lozinka tačna a 2FA još nije
// uključena. Dva koraka razdvojena `action` poljem (start = generiši tajnu i rezervne
// kodove, confirm = potvrdi prvi kod). Sesijski kolačić se upisuje ISKLJUČIVO na uspešan
// `confirm`, isti obrazac kao ../mfa/route.ts — nijedan drugi put ovde ne sme upisati sesiju.
export async function POST(req: NextRequest) {
  const { action, setupToken, code } = await req.json();

  try {
    if (action === 'start') {
      const result = await apiFetch<{ otpauthUrl: string; recoveryCodes: string[] }>(
        '/iam/auth/mfa/setup/start',
        { method: 'POST', body: { setupToken }, auth: false },
      );
      return NextResponse.json(result);
    }

    const result = await apiFetch<{ accessToken: string; refreshToken: string }>(
      '/iam/auth/mfa/setup/confirm',
      { method: 'POST', body: { setupToken, code }, auth: false },
    );

    const payload = JSON.parse(Buffer.from(result.accessToken.split('.')[1], 'base64url').toString('utf8'));
    await setSession({ accessToken: result.accessToken, refreshToken: result.refreshToken, userId: payload.sub });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Podešavanje 2FA nije uspelo' }, { status: err.status });
    }
    throw err;
  }
}
