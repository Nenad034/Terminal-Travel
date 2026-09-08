import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/badge';
import Pagination from '@/components/Pagination';
import ContractsFilterBar from './ContractsFilterBar';

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
  searchParams: Promise<{ page?: string; q?: string; status?: string; supplierId?: string }>;
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

      {!error && <ContractsFilterBar suppliers={suppliers} />}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          {contracts.length === 0 && (
            <p className="p-4 text-center text-xs text-ink-faint">
              Nema ugovora koji odgovaraju filterima.
            </p>
          )}
          {contracts.map((c) => (
            // `id` (23.8.2026, na zahtev vlasnika: "ovo treba da ima linkove ka stavkama na koje
            // obavestava") — dashboard upozorenje ("M3 — rokovi povrata alotmana") i dalje može
            // da skoči na ovaj anchor (`/ugovori#contract-{id}`); klik na red sada dodatno vodi
            // na pravi detalj-ekran ugovora (dopunjeno 29.8.2026, vidi [id]/page.tsx).
            <Link
              key={c.id}
              id={`contract-${c.id}`}
              href={`/ugovori/${c.id}`}
              className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
            >
              <div>
                <div className="font-medium text-ink">
                  {c.contractNumber}{' '}
                  <span className="text-ink-faint">
                    — {suppliersById.get(c.supplierId) ?? c.supplierId}
                  </span>
                </div>
                <div className="text-xs text-ink-faint">
                  {c.currency} · {new Date(c.validFrom).toLocaleDateString('sr-RS')} –{' '}
                  {new Date(c.validTo).toLocaleDateString('sr-RS')}
                </div>
              </div>
              <span className="flex items-center gap-2">
                <StatusBadge status={c.status} />
                {/* 8.9.2026 — red JESTE bio klikabilan, ali ništa to nije pokazivalo; a period
                    sa kapacitetom se unosi tek unutra. */}
                <span className="text-[11px] text-accent-strong">otvori →</span>
              </span>
            </Link>
          ))}
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

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={
        status === 'ACTIVE'
          ? 'ok'
          : status === 'EXPIRED' || status === 'TERMINATED'
            ? 'danger'
            : 'secondary'
      }
    >
      {status}
    </Badge>
  );
}
