import { apiFetch } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import EditProductForm from './EditProductForm';
import RoomTypesEditor, { type RoomType } from './RoomTypesEditor';
import HotelAttributesEditor, { type HotelAttributes } from './HotelAttributesEditor';


interface Product {
  id: string;
  type: string;
  destinationCountry: string;
  destinationCity: string;
  status: string;
  sourceType: string;
  attributes?: (HotelAttributes & { room_types?: RoomType[] }) | null;
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
    </div>
  );
}
