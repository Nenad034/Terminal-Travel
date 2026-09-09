import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import Pagination from '@/components/Pagination';
import ContractsFilterBar from './ContractsFilterBar';
import ContractsList from './ContractsList';
import ProductScopeFilterBar from '@/components/ProductScopeFilterBar';

interface Contract {
  id: string;
  supplierId: string;
  contractNumber: string;
  currency: string;
  status: string;
  validFrom: string;
  validTo: string;
}

interface Supplier {
  id: string;
  name: string;
}

// M17 spec §4/§7 (Faza 1) — "Dobavljači i ugovori", M3 §6 ugovori.
export default async function ContractsPage(props: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
    supplierId?: string;
    // v1.24 — filteri kroz proizvode tog ugovora (destinacija, objekat, vrsta proizvoda).
    destinationCountry?: string;
    destinationCity?: string;
    productName?: string;
    productType?: string | string[];
  }>;
}) {
  const searchParams = await props.searchParams;
  const me = await getMe();
  const canCreate = hasPermission(me, 'M3', 'contract', 'CREATE');

  let contracts: Contract[] = [];
  let suppliersById = new Map<string, string>();
  let suppliers: Supplier[] = [];
  // Razvrstavanje 8.9.2026 (dok. 27, nastavak nalaza 2.2) — `GET /contracting/contracts` sad
  // vraća `{ data, total, ... }`. Spisak dobavljača ostaje traženo sa `?limit=200`: ovde služi
  // ISKLJUČIVO kao mapa imena za `supplierId` svakog ugovora na trenutnoj strani, ne kao
  // sopstvena paginirana lista — puna lista dobavljača (uža strana) ostaje na `/dobavljaci`.
  let total = 0;
  let page = 1;
  let pageCount = 1;
  let limit = 50;
  let error: string | null = null;
  try {
    // Filteri idu na server (8.9.2026) — vidi ContractsFilterBar.tsx za obrazloženje.
    const qsParams = new URLSearchParams();
    if (searchParams?.page) qsParams.set('page', searchParams.page);
    if (searchParams?.q) qsParams.set('q', searchParams.q);
    if (searchParams?.status) qsParams.set('status', searchParams.status);
    if (searchParams?.supplierId) qsParams.set('supplierId', searchParams.supplierId);
    if (searchParams?.destinationCountry)
      qsParams.set('destinationCountry', searchParams.destinationCountry);
    if (searchParams?.destinationCity)
      qsParams.set('destinationCity', searchParams.destinationCity);
    if (searchParams?.productName) qsParams.set('productName', searchParams.productName);
    for (const t of Array.isArray(searchParams?.productType)
      ? searchParams.productType
      : searchParams?.productType
        ? [searchParams.productType]
        : []) {
      qsParams.append('productType', t);
    }
    const qs = qsParams.toString() ? `?${qsParams.toString()}` : '';
    const [contractsRes, suppliersRes] = await Promise.all([
      apiFetch<{
        data: Contract[];
        total: number;
        page: number;
        pageCount: number;
        limit: number;
      }>(`/contracting/contracts${qs}`),
      apiFetch<{ data: Supplier[] }>('/contracting/suppliers?limit=200'),
    ]);
    contracts = contractsRes.data;
    total = contractsRes.total;
    page = contractsRes.page;
    pageCount = contractsRes.pageCount;
    limit = contractsRes.limit;
    suppliers = suppliersRes.data;
    suppliersById = new Map(suppliersRes.data.map((s) => [s.id, s.name]));
  } catch {
    error = 'Nemate dozvolu za uvid u ugovore (M3/contract/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Ugovori i kapaciteti" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Ugovori i kapaciteti</h1>
          {/* 8.9.2026 — vlasnikovo pitanje "gde se definišu kapaciteti". Ekran je postojao, ali
              ni naziv ni navigacija nisu odavali da se kapacitet unosi baš ovde. */}
          <p className="text-xs text-ink-faint">
            Kapacitet se unosi unutar ugovora: otvori ugovor → &bdquo;Periodi / sezone&ldquo; →
            &bdquo;Ukupan kapacitet&ldquo;. Dnevno stanje se posle gleda na ekranu{' '}
            <Link href="/kapaciteti" className="text-accent-strong hover:underline">
              Kapaciteti
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dobavljaci"
            className="flex items-center gap-1.5 rounded border border-border bg-panel px-3 py-1.5 text-xs font-medium text-ink-dim hover:border-accent"
          >
            <Icon name="organization" /> dobavljači
          </Link>
          {canCreate && (
            <Link
              href="/ugovori/novi"
              className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong"
            >
              <Icon name="add" /> nov ugovor
            </Link>
          )}
        </div>
      </div>

      {!error && (
        <ProductScopeFilterBar
          action="/ugovori"
          polja={{
            productType: 'productType',
            destinationCountry: 'destinationCountry',
            destinationCity: 'destinationCity',
            productName: 'productName',
          }}
          desno={
            <span className="text-[11px] text-ink-faint">
              {total} {total === 1 ? 'ugovor' : 'ugovora'}
            </span>
          }
        />
      )}

      {/* Postojeća traka (broj ugovora / status / dobavljač) OSTAJE — nova traka je dopuna za
          destinaciju i vrstu proizvoda, ne zamena za filtere koji rade nad samim ugovorom. */}
      {!error && <ContractsFilterBar suppliers={suppliers} />}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          <ContractsList
            contracts={contracts.map((c) => ({
              id: c.id,
              contractNumber: c.contractNumber,
              supplierName: suppliersById.get(c.supplierId) ?? c.supplierId,
              status: c.status,
              currency: c.currency,
              validFrom: c.validFrom,
              validTo: c.validTo,
            }))}
          />
        </div>
      )}

      {!error && (
        <Pagination
          page={page}
          pageCount={pageCount}
          total={total}
          shown={contracts.length}
          limit={limit}
          basePath="/ugovori"
          searchParams={searchParams ?? {}}
          itemLabel="ugovora"
        />
      )}
    </div>
  );
}
