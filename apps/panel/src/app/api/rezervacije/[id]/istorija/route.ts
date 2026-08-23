import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// Dopuna (23.8.2026, na zahtev vlasnika — "citav workflow te rezervacije... sa datumima,
// vremenima i ko je radio promenu") — tanak posrednik ka GET /sales/bookings/:id/history
// (M5 spec §11), isti obrazac kao ostale BFF rute. Klijentska komponenta (dugme/modal na listi
// i na detalju rezervacije) ne sme direktno da zove backend (bez pristupa sesijskom kolačiću).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await apiFetch(`/sales/bookings/${id}/history`, { requireAuth: true });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Istorija rezervacije nije dostupna' }, { status: err.status });
    }
    throw err;
  }
}
