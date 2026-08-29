import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import NadzorSubnav from '../NadzorSubnav';
import TrendSuggestionActions from './TrendSuggestionActions';
import { Badge } from '@/components/ui/badge';

interface TrendSuggestion {
  id: string;
  category: string;
  summary: string;
  suggestedAction: string;
  status: string;
  approvedBy: string | null;
  createdAt: string;
}

// M17 spec §4/§7 (Faza 7) — M18 §5/§9. GET /ops/trend-suggestions (M18/trend-suggestion/VIEW),
// odobri/odbij (M18/trend-suggestion/APPROVE) — samo DRAFT predlozi mogu preći u
// APPROVED/REJECTED (spec §5.1/§10, "ništa se ne menja automatski bez odobrenja").
export default async function NadzorTrendoviPage() {
  const me = await getMe();
  const canApprove = hasPermission(me, 'M18', 'trend-suggestion', 'APPROVE');

  let suggestions: TrendSuggestion[] = [];
  let error: string | null = null;
  try {
    suggestions = await apiFetch<TrendSuggestion[]>('/ops/trend-suggestions');
  } catch {
    error = 'Nemate dozvolu za uvid u predloge trendova (M18/trend-suggestion/VIEW).';
  }

  const sorted = [...suggestions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="p-6">
      <RegisterTab label="Nadzor — trendovi" />
      <div className="mb-4">
        <h1 className="font-mono text-lg">
          <span className="text-accent">$</span> nadzor/trendovi/
        </h1>
        <p className="text-xs text-ink-dim">Predlozi agenta za praćenje trendova (M18 spec §5) — čeka ljudsko odobrenje pre ulaska u Dodatak A Master dokumenta.</p>
      </div>

      <NadzorSubnav active="/nadzor/trendovi" />

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="flex flex-col gap-2">
          {sorted.length === 0 && <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-ink-faint">Nema predloga.</p>}
          {sorted.map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-panel p-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <Badge variant="secondary" className="text-ink-faint">
                  {s.category}
                </Badge>
                <StatusBadge status={s.status} />
              </div>
              <p className="text-ink">{s.summary}</p>
              <p className="mt-1 text-xs text-ink-dim">
                <span className="text-ink-faint">predložena akcija:</span> {s.suggestedAction}
              </p>
              <p className="mt-1 text-[11px] text-ink-faint">
                {new Date(s.createdAt).toLocaleString('sr-RS')}
                {s.approvedBy ? ` · odobrio ${s.approvedBy}` : ''}
              </p>
              {canApprove && s.status === 'DRAFT' && (
                <div className="mt-2 border-t border-border pt-2">
                  <TrendSuggestionActions id={s.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'APPROVED') return <Badge variant="ok">{status}</Badge>;
  if (status === 'REJECTED') return <Badge variant="danger">{status}</Badge>;
  return <Badge variant="warn">{status}</Badge>;
}
