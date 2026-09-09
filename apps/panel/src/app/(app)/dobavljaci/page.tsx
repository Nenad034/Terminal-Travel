import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/button';
import Pagination from '@/components/Pagination';
import ProductScopeFilterBar from '@/components/ProductScopeFilterBar';
import SuppliersList, { type SupplierRow as Supplier } from './SuppliersList';

// Filteri (9.9.2026, vlasnikov zahtev) — ekran do sad nije imao NIJEDAN, ni pretragu po imenu.
// Destinacija/mesto/hotel gađaju PROIZVODE tog dobavljača, ne njegovo sedište: `Supplier.country`
// je država firme, pa „Grčka" nad spiskom dobavljača mora da znači „ko nam prodaje u Grčkoj"
// (vlasnikova odluka 9.9.2026, obrazloženje u `apps/api/.../m3-.../product-scope.ts`).
const FILTER_PARAMS = [
  'q',
  'destinationCountry',
  'destinationCity',
  'productName',
  'productType',
] as const;

// M17 spec §4/§7 (Faza 1) — "Dobavljači i ugovori", jedna nav stavka koja pokriva oba M3
// resursa (§6 M3 spec). Ova stranica je lista dobavljača; ugovori žive na /ugovori.
export default async function SuppliersPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const me = await getMe();
  const canCreate = hasPermission(me, 'M3', 'supplier', 'CREATE');
  const canViewContracts = hasPermission(me, 'M3', 'contract', 'VIEW');

  let suppliers: Supplier[] = [];
  // Razvrstavanje 8.9.2026 (dok. 27, nastavak nalaza 2.2) — `GET /contracting/suppliers` sad
  // vraća `{ data, total, ... }` na ovom, jedinom PRAVOM browse ekranu za dobavljače.
  let total = 0;
  let page = 1;
  let pageCount = 1;
  let limit = 50;
  let error: string | null = null;
  try {
    const qsParams = new URLSearchParams();
    if (typeof searchParams?.page === 'string') qsParams.set('page', searchParams.page);
    for (const kljuc of FILTER_PARAMS) {
      const v = searchParams?.[kljuc];
      if (Array.isArray(v)) for (const x of v) qsParams.append(kljuc, x);
      else if (v) qsParams.set(kljuc, v);
    }
    const qs = qsParams.toString() ? `?${qsParams.toString()}` : '';
    const result = await apiFetch<{
      data: Supplier[];
      total: number;
      page: number;
      pageCount: number;
      limit: number;
    }>(`/contracting/suppliers${qs}`);
    suppliers = result.data;
    total = result.total;
    page = result.page;
    pageCount = result.pageCount;
    limit = result.limit;
  } catch {
    error = 'Nemate dozvolu za uvid u dobavljače (M3/supplier/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Dobavljači i ugovori" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Dobavljači i ugovori</h1>
        </div>
        <div className="flex gap-2">
          {canViewContracts && (
            <Button asChild variant="outline" size="sm">
              <Link href="/ugovori" className="flex items-center gap-1.5">
                <Icon name="file-text" /> ugovori
              </Link>
            </Button>
          )}
          {canCreate && (
            <Button asChild size="sm">
              <Link href="/dobavljaci/novi" className="flex items-center gap-1.5">
                <Icon name="add" /> novi dobavljač
              </Link>
            </Button>
          )}
        </div>
      </div>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <>
          <ProductScopeFilterBar
            action="/dobavljaci"
            polja={{
              productType: 'productType',
              destinationCountry: 'destinationCountry',
              destinationCity: 'destinationCity',
              productName: 'productName',
              supplier: 'q',
            }}
            natpisi={{ supplier: 'Dobavljač (naziv)' }}
            desno={
              <span className="text-[11px] text-ink-faint">
                {total} {total === 1 ? 'dobavljač' : 'dobavljača'}
              </span>
            }
          />
          <div className="overflow-hidden rounded-lg border border-border">
            <SuppliersList suppliers={suppliers} />
          </div>
        </>
      )}

      {!error && (
        <Pagination
          page={page}
          pageCount={pageCount}
          total={total}
          shown={suppliers.length}
          limit={limit}
          basePath="/dobavljaci"
          searchParams={(searchParams ?? {}) as Record<string, string>}
          itemLabel="dobavljača"
        />
      )}
    </div>
  );
}
