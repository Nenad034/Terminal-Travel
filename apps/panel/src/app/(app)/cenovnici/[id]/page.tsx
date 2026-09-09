import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import RowsReview, { type UvozRed } from './RowsReview';
import RetryButton from './RetryButton';

// M3 spec §4.2.2/§4.2.3/§4.2.4, M17 §6c — pregled redova koje je AI izvukao.
//
// Ovo je jedini ekran na kom cena iz cenovnika postaje stvarna cena u ugovoru, i to isključivo
// klikom čoveka (§4.2.4). AI je do ovde uradio dve stvari: pročitao tabelu i predložio poklapanje
// hotela — nijednu nije upisao.

export const dynamic = 'force-dynamic';

interface Uvoz {
  id: string;
  supplierId: string;
  sourceFormat: string;
  sourceText: string | null;
  status: string;
  failureReason: string | null;
  createdAt: string;
}

export default async function UvozDetaljPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const me = await getMe();
  if (!hasPermission(me, 'M3', 'pricelist-import', 'VIEW')) {
    return (
      <div className="p-6">
        <RegisterTab label="Uvoz cenovnika" />
        <p className="rounded-lg border border-border bg-panel p-4 text-sm text-ink-dim">
          Nemate pravo uvida u uvoze cenovnika (M3/pricelist-import/VIEW).
        </p>
      </div>
    );
  }
  const canApprove = hasPermission(me, 'M3', 'pricelist-import', 'APPROVE_ROW');
  const canRetry = hasPermission(me, 'M3', 'pricelist-import', 'CREATE');

  const uvoz = await apiFetch<Uvoz>(`/contracting/pricelist-imports/${id}`);
  const [redovi, dobavljaci, proizvodi] = await Promise.all([
    apiFetch<UvozRed[]>(`/contracting/pricelist-imports/${id}/rows`).catch(() => [] as UvozRed[]),
    apiFetch<{ data: { id: string; name: string }[] }>('/contracting/suppliers?limit=200')
      .then((r) => r.data)
      .catch(() => []),
    // Kandidati za ručno poklapanje — proizvodi TOG dobavljača, isti skup koji je i AI gledao.
    apiFetch<{
      data: {
        id: string;
        destinationCity: string;
        destinationCountry: string;
        supplierName?: string | null;
        translation?: { name: string } | null;
      }[];
    }>('/catalog/products')
      .then((r) => r.data)
      .catch(() => []),
  ]);

  const dobavljac = dobavljaci.find((d) => d.id === uvoz.supplierId);
  const kandidati = proizvodi.map((p) => ({
    id: p.id,
    label: `${p.translation?.name ?? '(bez naziva)'} — ${p.destinationCity}, ${p.destinationCountry}`,
  }));

  const cekaju = redovi.filter((r) => r.reviewStatus === 'PENDING').length;

  return (
    <div className="flex flex-col gap-4 p-6">
      <RegisterTab label={`Uvoz — ${dobavljac?.name ?? uvoz.supplierId}`} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/cenovnici" className="text-[11px] text-accent-strong hover:underline">
            ← svi uvozi
          </Link>
          <h1 className="text-lg font-semibold text-ink">{dobavljac?.name ?? uvoz.supplierId}</h1>
          <p className="text-xs text-ink-faint">
            {new Date(uvoz.createdAt).toLocaleString('sr-RS')} · {uvoz.sourceFormat} ·{' '}
            {redovi.length} {redovi.length === 1 ? 'red' : 'redova'}
            {cekaju > 0 && ` · ${cekaju} čeka odluku`}
          </p>
        </div>
        {uvoz.status === 'FAILED' && canRetry && <RetryButton importId={uvoz.id} />}
      </div>

      {uvoz.failureReason && (
        <p className="rounded-lg bg-danger-bg p-3 text-xs text-danger">
          <strong>Uvoz nije uspeo.</strong> {uvoz.failureReason}
        </p>
      )}

      {redovi.length > 0 && (
        <p className="rounded-lg bg-sunken p-3 text-[11px] text-ink-faint">
          <Icon name="sparkle" /> AI je pročitao tabelu i predložio poklapanje sa katalogom.{' '}
          <strong className="text-ink">Ništa još nije upisano u cenovnik.</strong> Potvrda reda
          pravi period ugovora i cenovnu stavku — proverite iznos i period pre nego što potvrdite.
        </p>
      )}

      <RowsReview importId={uvoz.id} rows={redovi} kandidati={kandidati} canApprove={canApprove} />

      {uvoz.sourceText && (
        <details className="rounded-lg border border-border bg-panel p-3">
          <summary className="cursor-pointer text-xs font-medium text-ink">
            Izvorni tekst koji je AI čitao
          </summary>
          {/* Izvor stoji uz rezultat namerno: bez njega se ne može proveriti da li je AI nešto
              pogrešno pročitao ili je tako i pisalo u cenovniku. */}
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-sunken p-2 font-mono text-[11px] text-ink-dim">
            {uvoz.sourceText}
          </pre>
        </details>
      )}
    </div>
  );
}
