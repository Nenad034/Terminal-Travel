import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M1 spec §5, §6 — POST /iam/auth/login. Panel je isključivo za account_type=STAFF sa
// obaveznom 2FA (M17 spec §3), pa odgovor ima TRI oblika, ne dva: `requiresMfa` (2FA već
// podešena — sledi unos koda), `requiresMfaSetup` (obavezna a još nije podešena — sledi
// prvo podešavanje, dopuna 4.9.2026) i par tokena (nalog kome 2FA nije obavezna).
//
// Nalaz 4.9.2026: kad je uveden treći oblik, ova ruta nije bila dopunjena — odgovor bez
// `requiresMfa` padao je u granu koja čita `result.accessToken`, pa je prijava rušila rutu
// sa 500 umesto da vodi na podešavanje 2FA. Zato svaki oblik ovde ima svoju izričitu granu.
//
// Sesija se NE upisuje ovde ni u jednom slučaju osim poslednjeg — kolačić upisuju
// POST /api/session/mfa i POST /api/session/mfa-setup, svaki tek posle stvarne provere.
export async function POST(req: NextRequest) {
  const dto = await req.json();

  try {
    const result = await apiFetch<
      | { requiresMfa: true; mfaToken: string }
      | { requiresMfaSetup: true; setupToken: string }
      | { accessToken: string; refreshToken: string }
    >('/iam/auth/login', { method: 'POST', body: dto, auth: false });

    if ('requiresMfa' in result) {
      return NextResponse.json(result);
    }

    // M1 spec §5 (dopuna 4.9.2026) — nalog kome je 2FA obavezna a još je nema. Odgovor se
    // prosleđuje netaknut; sesija se NE upisuje ovde (setupToken nije pristupni token, i
    // panel se otvara tek posle uspešnog mfa/setup/confirm — vidi ../mfa-setup/route.ts).
    if ('requiresMfaSetup' in result) {
      return NextResponse.json(result);
    }

    // Fail-closed umesto pada: svaki naredni oblik odgovora koji ova ruta ne poznaje mora
    // dati čitljivu poruku, ne TypeError na `result.accessToken`. Upravo to se desilo kad je
    // uveden `requiresMfaSetup` — nepoznat oblik je ućutao u ovoj grani i srušio rutu.
    if (!('accessToken' in result)) {
      return NextResponse.json(
        { message: 'Prijava je vratila odgovor koji panel ne prepoznaje — javite timu.' },
        { status: 500 },
      );
    }

    // Nalog bez mfaEnabled (retko za STAFF, M1 spec §5 zahteva 2FA pre prve prijave) —
    // svejedno prihvatamo tokene direktno, isti obrazac kao apps/web.
    const { setSession } = await import('@/lib/session');
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
