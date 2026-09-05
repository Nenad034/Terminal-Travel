import { apiFetch } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import EditProductForm from './EditProductForm';
import RoomTypesEditor, { type RoomType } from './RoomTypesEditor';
import HotelAttributesEditor, { type HotelAttributes } from './HotelAttributesEditor';
import PackageAttributesEditor, { type PackageAttributes, type PickableProduct } from './PackageAttributesEditor';
import PackageDeparturesEditor, { type PackageDeparture } from './PackageDeparturesEditor';


interface Product {
  id: string;
  type: string;
  destinationCountry: string;
  destinationCity: string;
  // M2 spec §2.1b (4.9.2026) — regija/poluostrvo/grupa ostrva, opciono, KAD se razlikuje od
  // destinationCity (npr. "Sitonija, Halkidiki" za mesto koje je unutar Halkidikija).
  destinationArea: string | null;
  /**
   * M2 §2.1 — koordinate za prikaz na mapi. Popunjava ih `geocode-products.ts` iz naziva i
   * mesta (vlasnikova odluka 2.9.2026: automatski, ne ručno).
   *
   * Tip je `string`, ne `number`: u bazi je `Decimal`, a `Decimal.toJSON()` ga šalje kao
   * string — zamka 10.1 u `33-ZAMKE-I-OBAVEZNE-PROVERE.md`. `GET /sales/search` isto polje
   * vraća kao broj jer ga servis tamo eksplicitno pretvara; ovaj (katalog) endpoint ne.
   */
  geoLat: string | null;
  geoLng: string | null;
  status: string;
  sourceType: string;
  attributes?: (HotelAttributes & PackageAttributes & { room_types?: RoomType[] }) | null;
  translations?: { languageCode: string; name: string; description: string; slug: string }[];
}

export default async function ProductDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const product = await apiFetch<Product>(`/catalog/products/${params.id}`);
  const sr = product.translations?.find((t) => t.languageCode === 'sr');
  const name = sr?.name ?? '(bez naziva)';

  return (
    <div className="p-6">
      <RegisterTab label={name} />
      <h1 className="mb-1 text-lg font-semibold text-ink">{name}</h1>
      {/* Koordinate — dok mapa u pretrazi (M5 §3.0h) ne postoji, ovo je jedino mesto gde se
          vidi da li je tačka uopšte popunjena i da li je tačna. Veza otvara tačku na
          OpenStreetMap-u, pa čovek može da proveri pogodak bez ijedne nove biblioteke. */}
      <p className="mb-4 text-xs text-ink-faint">
        {product.geoLat && product.geoLng ? (
          <>
            koordinate: <span className="font-mono">{Number(product.geoLat).toFixed(5)}, {Number(product.geoLng).toFixed(5)}</span>{' '}
            <a
              href={`https://www.openstreetmap.org/?mlat=${product.geoLat}&mlon=${product.geoLng}#map=16/${product.geoLat}/${product.geoLng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-strong hover:underline"
            >
              proveri na mapi
            </a>
          </>
        ) : (
          <span className="text-warn">koordinate nisu popunjene — proizvod se neće pojaviti na mapi</span>
        )}
      </p>
      <EditProductForm
        productId={product.id}
        translation={sr}
        destination={{
          destinationCountry: product.destinationCountry,
          destinationCity: product.destinationCity,
          destinationArea: product.destinationArea,
        }}
      />
      {product.type === 'ACCOMMODATION' && (
        <div className="mt-4">
          <RoomTypesEditor productId={product.id} initialRoomTypes={product.attributes?.room_types ?? []} />
          <HotelAttributesEditor
            productId={product.id}
            initial={{
              accommodation_type: product.attributes?.accommodation_type ?? null,
              stars: product.attributes?.stars ?? null,
              board_type: product.attributes?.board_type ?? null,
              amenities: product.attributes?.amenities ?? [],
              contact: product.attributes?.contact ?? null,
            }}
          />
        </div>
      )}
      {product.type === 'PACKAGE' && (
        <PackageEditorSection
          productId={product.id}
          initial={{
            duration_days: product.attributes?.duration_days ?? null,
            included_products: product.attributes?.included_products ?? [],
          }}
        />
      )}
    </div>
  );
}

// M5 spec §3.0d.6a — grupni paket bira sastojke iz CELOG kataloga (nije ograničen na jedan tip
// proizvoda ni na jedan izvor cene, presek FIXED/CHARTER perioda odlučuje termin, ne Product.type).
// PACKAGE proizvodi su isključeni iz liste kandidata (paket unutar paketa nije pokriveno spec-om).
async function PackageEditorSection({ productId, initial }: { productId: string; initial: PackageAttributes }) {
  const [all, departures] = await Promise.all([
    apiFetch<{ id: string; type: string; destinationCity: string; destinationCountry: string; translations?: { languageCode: string; name: string }[] }[]>(
      '/catalog/products',
    ),
    apiFetch<PackageDeparture[]>(`/catalog/products/${productId}/package-departures`),
  ]);
  const candidates: PickableProduct[] = all
    .filter((p) => p.id !== productId && p.type !== 'PACKAGE')
    .map((p) => ({
      id: p.id,
      type: p.type,
      name: p.translations?.find((t) => t.languageCode === 'sr')?.name ?? '(bez naziva)',
      destinationCity: p.destinationCity,
      destinationCountry: p.destinationCountry,
    }));
  return (
    <>
      <PackageAttributesEditor productId={productId} initial={initial} candidates={candidates} />
      <PackageDeparturesEditor productId={productId} initialDepartures={departures} hasDurationDays={typeof initial.duration_days === 'number'} />
    </>
  );
}
