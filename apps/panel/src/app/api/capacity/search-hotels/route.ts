import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';

// BFF za prediktivnu pretragu hotela na ekranu Kapaciteti (M17 §4b.0a, M3 §6
// `GET /contracting/capacity/search-hotels`). Isti obrazac kao `../history/route.ts`: klijentska
// komponenta ne sme da zove `apiFetch` (server-only), a dozvola se proverava i ovde.

export interface HotelSearchHit {
  productId: string;
  name: string;
  type: string;
  status: string;
  stars: number | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  contractId: string | null;
  contractStatus: string | null;
  contractNumber: string | null;
  apiProvider: string | null;
}

export async function GET(req: NextRequest) {
  const me = await getMe();
  if (!me) return NextResponse.json({ message: 'Nije prijavljen' }, { status: 401 });
  if (!hasPermission(me, 'M3', 'capacity', 'VIEW')) {
    return NextResponse.json(
      { message: 'Nemate pravo uvida u kapacitete (M3/capacity/VIEW).' },
      { status: 403 },
    );
  }
  const q = req.nextUrl.searchParams.get('q') ?? '';
  try {
    const hits = await apiFetch<HotelSearchHit[]>(
      `/contracting/capacity/search-hotels?q=${encodeURIComponent(q)}`,
    );
    return NextResponse.json(hits);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json({ message: 'Pretraga trenutno nije dostupna.' }, { status });
  }
}
