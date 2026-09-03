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
    const suppliers = await apiFetch<{ id: string; name: string; status: string }[]>('/contracting/suppliers', { requireAuth: true });
    return NextResponse.json(
      suppliers.filter((s) => s.status === 'ACTIVE').map((s) => ({ id: s.id, name: s.name })),
    );
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Spisak dobavljača nije dostupan' }, { status: err.status });
    }
    throw err;
  }
}
