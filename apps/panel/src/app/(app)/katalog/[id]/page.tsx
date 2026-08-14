import { apiFetch } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import EditProductForm from './EditProductForm';

interface Product {
  id: string;
  type: string;
  destinationCountry: string;
  destinationCity: string;
  status: string;
  sourceType: string;
  translations?: { languageCode: string; name: string; description: string; slug: string }[];
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const product = await apiFetch<Product>(`/catalog/products/${params.id}`);
  const sr = product.translations?.find((t) => t.languageCode === 'sr');
  const name = sr?.name ?? '(bez naziva)';

  return (
    <div className="mx-auto max-w-lg p-6">
      <RegisterTab label={name} />
      <h1 className="mb-1 font-mono text-lg">
        <span className="text-accent">$</span> {name}
      </h1>
      <p className="mb-4 text-xs text-ink-faint">
        {product.type} · {product.destinationCity}, {product.destinationCountry} · izvor: {product.sourceType}
      </p>
      <EditProductForm productId={product.id} translation={sr} />
    </div>
  );
}
