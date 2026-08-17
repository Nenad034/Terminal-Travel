import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M8 spec §3a, dopuna avgust 2026 (M15 dobio kod) — jedini put ka
// POST /ai-orchestration/omnisearch iz browsera ide server-to-server odavde (§1 BFF pravilo).
// `auth: true` (podrazumevano u apiFetch) prilaže sesijski token AKO gost postoji prijavljen —
// anoniman posetilac šalje zahtev bez tokena, backend to prihvata SAMO za channel=B2C_SITE
// (omnisearch.controller.ts, M15 spec §6.5, M8 §3a "radi anonimno").
export async function POST(req: NextRequest) {
  const dto = await req.json();

  try {
    const result = await apiFetch(`/ai-orchestration/omnisearch`, {
      method: 'POST',
      body: { query: dto.query, channel: 'B2C_SITE', lang: dto.lang },
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Pretraga trenutno nije dostupna' }, { status: err.status });
    }
    throw err;
  }
}
