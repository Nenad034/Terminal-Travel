import { apiFetch } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import EditProductForm from './EditProductForm';
import RoomTypesEditor, { type RoomType } from './RoomTypesEditor';

interface Product {
  id: string;
  type: string;
  destinationCountry: string;
  destinationCity: string;
  status: string;
  sourceType: string;
  attributes?: { room_types?: RoomType[] } | null;
  translations?: { languageCode: string; name: string; description: string; slug: string }[];
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
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
        </div>
      )}
    </div>
  );
}
