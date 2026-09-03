import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M5 spec §6.7 — tanak posrednik ka `GET /catalog/products` (M2), za izbor usluge pri
// dodavanju na postojeću rezervaciju (`AddServicePanel.tsx`). Isti obrazac kao
// `search-suggest/route.ts`: klijentska komponenta ne sme da vidi JWT, pa poziv ide preko
// servera.
//
// Zašto se lista ne dovlači na serveru zajedno sa stranicom (kao spisak kandidata za IZMENU
// usluge u `page.tsx`): tamo su tipovi poznati unapred (oni koji su već na rezervaciji, obično
// jedan-dva), ovde bi trebalo dovući katalog za svih osam vrsta pri svakom otvaranju kartice
// Aranžman — a agent u ogromnoj većini slučajeva neće kliknuti nijednu ikonicu. Lista se zato
// traži tek kad se ikonica stvarno klikne.
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');
  if (!type) return NextResponse.json({ message: 'Nedostaje `type`.' }, { status: 400 });

  try {
    const result = await apiFetch<{ id: string; destinationCity: string; destinationCountry: string; translation: { name: string } | null }[]>(
      `/catalog/products?type=${encodeURIComponent(type)}&status=ACTIVE&lang=sr`,
      { requireAuth: true },
    );
    return NextResponse.json(
      result.map((p) => ({
        id: p.id,
        name: p.translation?.name ?? p.id.slice(0, 8),
        destinationCity: p.destinationCity,
        destinationCountry: p.destinationCountry,
      })),
    );
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Katalog nije dostupan' }, { status: err.status });
    }
    throw err;
  }
}
