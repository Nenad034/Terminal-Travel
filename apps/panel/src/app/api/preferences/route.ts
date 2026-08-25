import { NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// Dopuna (24.8.2026, na zahtev vlasnika: "Filtere za listu rezervacija stavimo u levi panel...
// sačuvani prikazi", dizajn dok. §5b) — tanak posrednik ka GET /iam/users/me/preferences
// (M1 spec §3.9), isti obrazac kao ostale BFF rute. Vraća SVE preference korisnika kao mapu
// ključ→vrednost — ekrani (npr. `SavedViewsSidebarPanel.tsx`) čitaju samo svoj ključ.
export async function GET() {
  try {
    const result = await apiFetch('/iam/users/me/preferences', { requireAuth: true });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Podešavanja nisu dostupna' }, { status: err.status });
    }
    throw err;
  }
}
