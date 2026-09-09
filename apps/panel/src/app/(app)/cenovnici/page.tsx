import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import NewImportForm from './NewImportForm';

// M3 spec §4.2/§4.2.6, M17 §6c (9.9.2026) — AI uvoz cenovnika.
//
// Backend tok je postojao (uvoz → redovi → ljudska potvrda → ContractPeriod/RateLine), ali ekrana
// nije bilo NIGDE: pretraga po „pricelist" kroz ceo `apps/panel/src` davala je nula pogodaka.
// Zato je vlasnik 9.9.2026 pitao gde se cene unose uz pomoć AI agenta — odgovor je bio „nigde",
// iako je posao dobrim delom bio napravljen.

export const dynamic = 'force-dynamic';

interface Uvoz {
  id: string;
  supplierId: string;
  sourceFormat: string;
  status: string;
  failureReason: string | null;
  createdAt: string;
}

const STATUS_OPIS: Record<string, { tekst: string; klasa: string }> = {
  PROCESSING: { tekst: 'obrada u toku', klasa: 'bg-warn-bg text-warn' },
  READY_FOR_REVIEW: { tekst: 'čeka pregled', klasa: 'bg-accent-soft text-accent-strong' },
  COMPLETED: { tekst: 'završen', klasa: 'bg-ok-bg text-ok' },
  REJECTED: { tekst: 'odbijen', klasa: 'bg-sunken text-ink-faint' },
  FAILED: { tekst: 'nije uspeo', klasa: 'bg-danger-bg text-danger' },
};

export default async function CenovniciPage() {
  const me = await getMe();
  const canView = hasPermission(me, 'M3', 'pricelist-import', 'VIEW');
  const canCreate = hasPermission(me, 'M3', 'pricelist-import', 'CREATE');

  if (!canView) {
    return (
      <div className="p-6">
        <RegisterTab label="Uvoz cenovnika" />
        <p className="rounded-lg border border-border bg-panel p-4 text-sm text-ink-dim">
          Nemate pravo uvida u uvoze cenovnika (M3/pricelist-import/VIEW).
        </p>
      </div>
    );
  }

  const [uvozi, dobavljaci] = await Promise.all([
    apiFetch<Uvoz[]>('/contracting/pricelist-imports').catch(() => [] as Uvoz[]),
    apiFetch<{ data: { id: string; name: string }[] }>('/contracting/suppliers?limit=200')
      .then((r) => r.data)
      .catch(() => []),
  ]);
  const imeDobavljaca = new Map(dobavljaci.map((d) => [d.id, d.name]));

  return (
    <div className="flex flex-col gap-4 p-6">
      <RegisterTab label="Uvoz cenovnika" />
      <div>
        <h1 className="flex items-center gap-1.5 text-lg font-semibold text-ink">
          <Icon name="sparkle" /> Uvoz cenovnika uz pomoć AI
        </h1>
        <p className="text-xs text-ink-faint">
          AI čita cenovnik dobavljača i priprema redove. <strong>Ništa se ne upisuje samo</strong> —
          svaki red potvrđujete vi, i tek tada nastaje cena u ugovoru (M3 §4.2.4).
        </p>
      </div>

      {canCreate && <NewImportForm suppliers={dobavljaci} />}

      <div className="overflow-hidden rounded-lg border border-border">
        {uvozi.length === 0 && (
          <p className="p-4 text-center text-xs text-ink-faint">
            Još nijedan cenovnik nije uvezen.
          </p>
        )}
        {uvozi.map((u) => {
          const s = STATUS_OPIS[u.status] ?? { tekst: u.status, klasa: 'bg-sunken text-ink-faint' };
          return (
            <Link
              key={u.id}
              href={`/cenovnici/${u.id}`}
              className="flex items-center justify-between gap-3 border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
            >
              <div className="min-w-0">
                <div className="font-medium text-ink">
                  {imeDobavljaca.get(u.supplierId) ?? u.supplierId}
                </div>
                <div className="text-xs text-ink-faint">
                  {new Date(u.createdAt).toLocaleString('sr-RS')} · {u.sourceFormat}
                </div>
                {/* Razlog neuspeha stoji odmah u spisku — bez njega je „nije uspeo" bez nastavka. */}
                {u.failureReason && (
                  <div className="mt-0.5 text-xs text-danger">{u.failureReason}</div>
                )}
              </div>
              <span
                className={`flex-shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${s.klasa}`}
              >
                {s.tekst}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
