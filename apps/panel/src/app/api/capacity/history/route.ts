import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';

// BFF za „Istoriju izmena" u panelu dana na ekranu Kapaciteti (M17 §4b.9, M3 §2.8g) — tanak
// proxy ka `GET /contracting/capacity/history`. Postoji zato što je istorija KLIJENTSKI deo
// ekrana (otvara se klikom na ćeliju, ne pri učitavanju strane), a klijentska komponenta ne sme
// da zove `apiFetch`/`getMe()` (server-only) — isti obrazac kao `/api/catalog/products/[id]/preview`.
//
// Dozvola se proverava i ovde, ne samo na API-ju: BFF ruta koja samo prosleđuje bez provere je
// tiho zaobilaženje panela (M17 §7), i backend bi je odbio tek posle nepotrebnog poziva.

export interface CapacityHistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  actorType: string;
  actorName: string;
  resourceType: string;
  resourceId: string;
  afterState: unknown;
  context: unknown;
}

export async function GET(req: NextRequest) {
  const me = await getMe();
  if (!me) return NextResponse.json({ message: 'Nije prijavljen' }, { status: 401 });
  if (!hasPermission(me, 'M3', 'capacity', 'VIEW')) {
    return NextResponse.json(
      { message: 'Nemate pravo uvida u istoriju kapaciteta (M3/capacity/VIEW).' },
      { status: 403 },
    );
  }

  const qs = new URLSearchParams();
  for (const kljuc of ['contractId', 'contractPeriodId', 'from', 'to', 'limit'] as const) {
    const v = req.nextUrl.searchParams.get(kljuc);
    if (v) qs.set(kljuc, v);
  }

  try {
    const entries = await apiFetch<CapacityHistoryEntry[]>(
      `/contracting/capacity/history?${qs.toString()}`,
    );
    return NextResponse.json(entries);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json({ message: 'Istorija trenutno nije dostupna.' }, { status });
  }
}
