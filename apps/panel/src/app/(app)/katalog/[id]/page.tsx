import { apiFetch } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import EditProductForm from './EditProductForm';
import RoomTypesEditor, { type RoomType } from './RoomTypesEditor';
import HotelAttributesEditor, { type HotelAttributes } from './HotelAttributesEditor';
import PackageAttributesEditor, {
  type PackageAttributes,
  type PickableProduct,
} from './PackageAttributesEditor';
import PackageDeparturesEditor, { type PackageDeparture } from './PackageDeparturesEditor';
import PublishPanel, { type Readiness } from './PublishPanel';
import { getMe, hasPermission } from '@/lib/me';

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
  /** M2 §5.2 — ugovor iz kog proizvod uzima cene; bez njega ga pretraga ne prikazuje. */
  sourceContractId: string | null;
  visibleChannels: string[];
  attributes?: (HotelAttributes & PackageAttributes & { room_types?: RoomType[] }) | null;
  translations?: { languageCode: string; name: string; description: string; slug: string }[];
}

export default async function ProductDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const product = await apiFetch<Product>(`/catalog/products/${params.id}`);
  const sr = product.translations?.find((t) => t.languageCode === 'sr');
  const name = sr?.name ?? '(bez naziva)';

  // M2 §5.2 (9.9.2026) — izvor cene i objava. Oba poziva smeju da padnu bez rušenja ekrana:
  // ugovori traže `M3/contract/VIEW`, koju nema svako ko sme da uređuje katalog, a provera
  // spremnosti je pomoć pri radu, ne uslov da se stranica prikaže.
  const me = await getMe();
  const canPublish = hasPermission(me, 'M2', 'product', 'PUBLISH');
  const [contracts, readiness] = await Promise.all([
    apiFetch<{
      data: { id: string; contractNumber: string; supplierId: string; status: string }[];
    }>('/contracting/contracts?limit=200')
      .then((r) => r.data)
      .catch(() => []),
    apiFetch<Readiness>(`/catalog/products/${params.id}/publish-readiness`).catch(() => null),
  ]);
  const suppliers = contracts.length
    ? await apiFetch<{ data: { id: string; name: string }[] }>('/contracting/suppliers?limit=200')
        .then((r) => r.data)
        .catch(() => [])
    : [];
  const supplierName = new Map(suppliers.map((x) => [x.id, x.name]));

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
            koordinate:{' '}
            <span className="font-mono">
              {Number(product.geoLat).toFixed(5)}, {Number(product.geoLng).toFixed(5)}
            </span>{' '}
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
          <span className="text-warn">
            koordinate nisu popunjene — proizvod se neće pojaviti na mapi
          </span>
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
      {canPublish && (
        <PublishPanel
          productId={product.id}
          status={product.status}
          sourceType={product.sourceType}
          sourceContractId={product.sourceContractId}
          visibleChannels={product.visibleChannels ?? []}
          contracts={contracts.map((c) => ({
            id: c.id,
            label: `${c.contractNumber} — ${supplierName.get(c.supplierId) ?? 'nepoznat dobavljač'}${
              c.status === 'ACTIVE' ? '' : ` (${c.status})`
            }`,
          }))}
          readiness={readiness}
        />
      )}
      {product.type === 'ACCOMMODATION' && (
        <div className="mt-4">
          <RoomTypesEditor
            productId={product.id}
            initialRoomTypes={product.attributes?.room_types ?? []}
          />
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
async function PackageEditorSection({
  productId,
  initial,
}: {
  productId: string;
  initial: PackageAttributes;
}) {
  const [all, departures] = await Promise.all([
    // ISPRAVKA 9.9.2026 — `GET /catalog/products` od 5.9.2026 vraća `{ data, total, ... }`,
    // ne go niz (M2 v1.23). Ovaj poziv je ostao na starom obliku, pa je `.filter` ispod padao
    // i detalj ekran svakog PACKAGE proizvoda rušio. Zamka 10.x roda: promena oblika odgovora
    // se ne vidi u `tsc` kad je tip ručno napisan uz `apiFetch<...>`.
    apiFetch<{
      data: {
        id: string;
        type: string;
        destinationCity: string;
        destinationCountry: string;
        translations?: { languageCode: string; name: string }[];
      }[];
    }>('/catalog/products').then((r) => r.data),
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
      <PackageDeparturesEditor
        productId={productId}
        initialDepartures={departures}
        hasDurationDays={typeof initial.duration_days === 'number'}
      />
    </>
  );
}
