import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';
import { setSession } from '@/lib/session';

// M8 spec poglavlje 3, korak 3 (dopuna avgust 2026) — POST /crm/client-accounts/guest-checkout.
// Isti obrazac kao /api/session/register — jedino mesto gde se M1 token direktno dobija i
// upisuje u httpOnly kolačić. Gost nikad ne vidi/bira lozinku (M6 GuestCheckoutService je sam
// generiše) — sa njegove tačke gledišta ovo je "nastavi bez naloga", ne registracija.
export async function POST(req: NextRequest) {
  const dto = await req.json();

  try {
    const tokens = await apiFetch<{ accessToken: string; refreshToken: string }>(
      '/crm/client-accounts/guest-checkout',
      { method: 'POST', body: dto, auth: false },
    );

    const payload = JSON.parse(Buffer.from(tokens.accessToken.split('.')[1], 'base64url').toString('utf8'));
    await setSession({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, userId: payload.sub });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Nastavak bez naloga nije uspeo' }, { status: err.status });
    }
    throw err;
  }
}
