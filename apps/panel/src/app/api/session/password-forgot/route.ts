import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M1 spec §5/§6 — POST /iam/auth/password/forgot (javan). Backend uvek odgovara isto, bez
// obzira da li nalog postoji — ovde se taj odgovor samo prosleđuje, bez ikakvog razlikovanja.
export async function POST(req: NextRequest) {
  const { email } = await req.json();

  try {
    await apiFetch('/iam/auth/password/forgot', { method: 'POST', body: { email }, auth: false });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Zahtev nije uspeo' }, { status: err.status });
    }
    throw err;
  }
}
