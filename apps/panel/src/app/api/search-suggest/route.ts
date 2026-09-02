import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M5 spec §3.0c.2 — tanak posrednik ka `GET /sales/search/countries` i `/destinations`, za
// predlaganje dok se kuca u formi pretrage (SuggestField.tsx). Isti obrazac kao ostale BFF
// rute: klijentska komponenta ne sme da vidi JWT, pa poziv ide preko servera.
//
// Jedna ruta za oba spiska (`?kind=countries|destinations`) umesto dve — razlika je samo u
// jednom parametru, a dve skoro identične rute bi se razišle pri prvoj izmeni.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kind = sp.get('kind') === 'destinations' ? 'destinations' : 'countries';

  const params = new URLSearchParams({ channel: 'INTERNAL_PANEL' });
  const q = sp.get('q');
  if (q) params.set('q', q);
  if (kind === 'destinations') {
    const country = sp.get('country');
    if (!country) return NextResponse.json({ message: 'Nedostaje `country`.' }, { status: 400 });
    params.set('country', country);
  }

  try {
    const result = await apiFetch(`/sales/search/${kind}?${params.toString()}`, { requireAuth: true });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Predlozi nisu dostupni' }, { status: err.status });
    }
    throw err;
  }
}
