import { NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M5 spec §6.7b — tanak posrednik ka `GET /contracting/suppliers` (M3), za izbor dobavljača pri
// ručnom unosu usluge na rezervaciji. Isti obrazac kao ostale BFF rute: klijentska komponenta
// ne sme da vidi JWT.
//
// Vraća samo `id`/`name`/`status` — ekranu ništa više ne treba, a poreski broj i bankovni račun
// dobavljača nemaju šta da odu u browser zbog jednog padajućeg spiska.
export async function GET() {
  try {
    // Razvrstavanje 8.9.2026 (dok. 27) — padajuća lista, ne browse ekran; `?limit=200` tvrd
    // plafon (GET /contracting/suppliers sad vraća { data, total, ... }).
    const result = await apiFetch<{ data: { id: string; name: string; status: string }[] }>(
      '/contracting/suppliers?limit=200',
      { requireAuth: true },
    );
    return NextResponse.json(
      result.data.filter((s) => s.status === 'ACTIVE').map((s) => ({ id: s.id, name: s.name })),
    );
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Spisak dobavljača nije dostupan' }, {
        status: err.status,
      });
    }
    throw err;
  }
}
