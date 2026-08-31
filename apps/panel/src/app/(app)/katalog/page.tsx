import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import TabLink from '@/components/TabLink';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';


interface Product {
  id: string;
  type: string;
  destinationCountry: string;
  destinationCity: string;
  status: string;
  sourceType: string;
  translations?: { languageCode: string; name: string }[];
}

// M17 spec §4/§7 (Faza 1) — "tim može ručno da unese proizvod (M2)". Lista poziva
// GET /catalog/products (interni kanal M17, uključuje source_* polja, M2 spec §7).
export default async function KatalogPage() {
  const me = await getMe();
  const canCreate = hasPermission(me, 'M2', 'product', 'CREATE');

  let products: Product[] = [];
  let error: string | null = null;
  try {
    products = await apiFetch<Product[]>('/catalog/products');
  } catch {
    error = 'Nemate dozvolu za uvid u katalog (M2/product/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Katalog proizvoda" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> ls katalog/
          </h1>
          <p className="text-xs text-ink-dim">Svi proizvodi (ugovoreni i API), bez obzira na izvor.</p>
        </div>
        {canCreate && (
          <Button asChild size="sm">
            <Link href="/katalog/novi" className="flex items-center gap-1.5">
              <Icon name="add" /> novi proizvod
            </Link>
          </Button>
        )}
      </div>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.length === 0 && <p className="text-xs text-ink-faint">Nema proizvoda u katalogu.</p>}
          {products.map((p) => {
            const name = p.translations?.find((t) => t.languageCode === 'sr')?.name ?? '(bez naziva)';
            return (
              <TabLink
                key={p.id}
                href={`/katalog/${p.id}`}
                label={name}
                className="rounded-lg border border-border bg-panel p-4 hover:border-accent"
                dragPayload={{
                  key: `katalog:${p.id}`,
                  moduleId: 'katalog-nabavka',
                  label: name,
                  subtitle: `${p.type} — ${p.destinationCity}, ${p.destinationCountry}`,
                  href: `/katalog/${p.id}`,
                }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <Badge variant="outline" className="border-transparent bg-accent2-soft text-accent2">
                    {p.type}
                  </Badge>
                  <Badge variant={p.status === 'ACTIVE' ? 'ok' : 'secondary'} className={p.status === 'ACTIVE' ? '' : 'text-ink-faint'}>
                    {p.status}
                  </Badge>
                </div>
                <div className="text-sm font-medium text-ink">{name}</div>
                <div className="text-xs text-ink-faint">
                  {p.destinationCity}, {p.destinationCountry}
                </div>
              </TabLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
