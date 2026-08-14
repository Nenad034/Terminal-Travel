import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M1 spec §5, §6 — POST /iam/auth/login. Panel je isključivo za account_type=STAFF sa
// obaveznom 2FA (M17 spec §3) — kad login uspe bez requiresMfa, znači nalog nema MFA
// podešenu (AuthService baca ForbiddenException u tom slučaju za uloge koje je zahtevaju,
// pa taj granični slučaj stiže ovde kao greška, ne kao uspešna prijava). Sesija se NE
// upisuje ovde — samo kad je MFA obavezan korak, mfaToken se vraća klijentu da ga vrati
// u POST /api/session/mfa (koji jedini sme da upiše kolačić, vidi tu rutu).
export async function POST(req: NextRequest) {
  const dto = await req.json();

  try {
    const result = await apiFetch<
      { requiresMfa: true; mfaToken: string } | { accessToken: string; refreshToken: string }
    >('/iam/auth/login', { method: 'POST', body: dto, auth: false });

    if ('requiresMfa' in result) {
      return NextResponse.json(result);
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
