import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

/**
 * M2 spec §2.3g — tanak posrednik ka `POST /catalog/products/bed-combinations/izvedi` (M2).
 *
 * Route Handler, a ne Server Action: ovo je ČITANJE koje se dešava dok se soba uređuje, a
 * Next.js otprema Server Actions jednu po jednu po klijentu (`server-actions.md`, "Sequential
 * dispatch on the client") i za nemutirajuće zahteve izričito upućuje na Route Handler. Kao
 * akcija bi svaka izmena broja kreveta čekala u redu iza snimanja sobe.
 *
 * Isti obrazac kao `catalog/products/route.ts`: klijentska komponenta ne sme da vidi JWT, pa
 * poziv ide preko servera.
 *
 * POST iako je čitanje — ulaz su kreveti iz otvorenog obrasca, ne zapamćena soba (§2.3g:
 * "matrica se izračunava, ne kuca"). Ništa se ne menja ni ovde ni na API strani.
 */
export async function POST(req: NextRequest) {
  let telo: unknown;
  try {
    telo = await req.json();
  } catch {
    return NextResponse.json({ message: 'Neispravan zahtev.' }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await apiFetch('/catalog/products/bed-combinations/izvedi', {
        method: 'POST',
        body: telo,
        requireAuth: true,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Matrica nije dostupna.' }, {
        status: err.status,
      });
    }
    throw err;
  }
}
