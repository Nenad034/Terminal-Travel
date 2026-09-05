import { apiFetch } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/badge';


interface ProductMedia {
  url: string;
  category: string;
  caption?: string | null;
}
interface RoomType {
  code: string;
  name: string;
  capacity_adults?: number;
  capacity_children?: number;
}
interface ProductDetail {
  id: string;
  type: string;
  destinationCity: string;
  destinationCountry: string;
  media: ProductMedia[] | null;
  attributes: {
    stars?: number;
    accommodation_type?: string;
    board_type?: string;
    amenities?: string[];
    room_types?: RoomType[];
  } | null;
  translation: { name: string; description: string } | null;
}

// Pun prikaz proizvoda u centralnom panelu (26.8.2026, na zahtev vlasnika, M17 spec "Desni
// panel — brzi pregled proizvoda", Faza B) — otvara se klikom "Prikaži pun opis" iz
// `ProductPreviewCard.tsx` (desni panel). Odvojena ruta od `/katalog/[id]` (postojeća stranica
// je FORMA ZA IZMENU, ne prikaz) — namerno prikazna, bez polja za unos. `apps/web` javna
// stranica (`[locale]/(site)/[tip]/[slug]`) trenutno nema pravu galeriju (samo placeholder) —
// ova stranica gradi sopstveni prikaz direktno iz `Product.media[]` (M2 spec §2.3a), ne
// kopira apps/web bukvalno.
export default async function ProductGalleryPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const product = await apiFetch<ProductDetail>(`/catalog/products/${params.id}`);
  const name = product.translation?.name ?? '(bez naziva)';
  const attrs = product.attributes ?? {};
  const media = product.media ?? [];

  return (
    <div className="p-6">
      <RegisterTab label={name} />
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-lg font-semibold text-ink">{name}</h1>
        {attrs.stars !== undefined && (
          <span className="rounded bg-panel2 px-1.5 py-0.5 text-[11px] font-semibold text-warn">{attrs.stars}*</span>
        )}
      </div>

      {media.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((m) => (
            <div key={m.url} className="overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={m.caption ?? name} className="aspect-[3/2] w-full object-cover" />
              {m.caption && <div className="bg-panel px-2 py-1 text-xs text-ink-faint">{m.caption}</div>}
            </div>
          ))}
        </div>
      )}
      {media.length === 0 && (
        <div className="mb-6 flex h-48 items-center justify-center rounded-lg bg-panel-2 text-ink-faint">
          <Icon name="device-camera" className="text-2xl" />
        </div>
      )}

      {product.translation?.description && (
        <p className="mb-6 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink-dim">{product.translation.description}</p>
      )}

      {attrs.amenities && attrs.amenities.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 text-xs font-medium text-ink-faint">Sadržaji</div>
          <div className="flex flex-wrap gap-1.5">
            {attrs.amenities.map((a) => (
              <Badge key={a} variant="secondary" className="text-ink-dim">
                {a}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {attrs.room_types && attrs.room_types.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium text-ink-faint">Tipovi soba</div>
          <div className="flex flex-col gap-1.5">
            {attrs.room_types.map((rt) => (
              <div key={rt.code} className="flex items-center justify-between rounded-lg border border-border bg-panel px-3 py-2 text-xs">
                <span className="text-ink">{rt.name}</span>
                <span className="text-ink-faint">
                  {rt.capacity_adults ?? '?'} odraslih{rt.capacity_children ? ` + ${rt.capacity_children} dece` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
