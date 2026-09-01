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
      <h1 className="mb-1 font-mono text-lg">
        <span className="text-accent">$</span> {name}
      </h1>
      <p className="mb-4 text-xs text-ink-faint">
        {product.type} · {product.destinationCity}, {product.destinationCountry} · izvor: {product.sourceType}
      </p>
      <EditProductForm productId={product.id} translation={sr} />
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
