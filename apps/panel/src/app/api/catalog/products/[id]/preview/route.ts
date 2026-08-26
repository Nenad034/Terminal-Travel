import { NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';

interface ProductMedia {
  url: string;
  category: string;
  caption?: string | null;
}
interface ProductDetail {
  id: string;
  type: string;
  destinationCity: string;
  destinationCountry: string;
  media: ProductMedia[] | null;
  attributes: Record<string, unknown> | null;
  translation: { name: string; description: string } | null;
}

// BFF za "brzi pregled" u desnom panelu (`ProductPreviewCard.tsx`, M17 spec "Desni panel — brzi
// pregled proizvoda", Faza B) — tanak proxy ka internom `GET /catalog/products/:id` (isti podaci
// koje već koristi `/katalog/[id]` forma), trimovan na ono što kartica prikazuje. Klijentska
// komponenta ne može direktno da pozove `apiFetch`/`getMe()` (server-only) — isti obrazac kao
// `/api/home-summary`.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const me = await getMe();
  if (!me) return NextResponse.json({ message: 'Nije prijavljen' }, { status: 401 });
  if (!hasPermission(me, 'M2', 'product', 'VIEW')) return NextResponse.json({ message: 'Nema dozvolu za katalog.' }, { status: 403 });

  try {
    const product = await apiFetch<ProductDetail>(`/catalog/products/${params.id}`);
    const attrs = product.attributes ?? {};
    return NextResponse.json({
      id: product.id,
      name: product.translation?.name ?? null,
      description: product.translation?.description ?? null,
      city: product.destinationCity,
      country: product.destinationCountry,
      stars: (attrs.stars as number | undefined) ?? null,
      amenities: (attrs.amenities as string[] | undefined) ?? null,
      // `attributes.contact` — opciona konvencija (M2 spec §2.3, dopuna 26.8.2026), nedostaje
      // kod proizvoda uvezenih pre ove dopune — kartica tad prikazuje "kontakt nije unet".
      contact: (attrs.contact as { phone?: string; email?: string; address?: string } | undefined) ?? null,
      photos: (product.media ?? []).map((m) => ({ url: m.url, caption: m.caption ?? null, category: m.category })),
    });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json({ message: 'Proizvod nije pronađen.' }, { status });
  }
}
