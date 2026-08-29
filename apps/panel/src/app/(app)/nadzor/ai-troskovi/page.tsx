import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import NadzorSubnav from '../NadzorSubnav';
import OverrideQuotaButton from './OverrideQuotaButton';
import { Badge } from '@/components/ui/badge';

// `budgetLimitEur`/`consumedEur` su Prisma `Decimal` na backendu (schema.prisma) — preko JSON-a
// stižu kao STRING, ne broj (Decimal.toJSON() vraća string), otud `string | null` ovde, ne
// `number`. Nalaz iz stvarne greške u produkciji (29.8.2026): `q.consumedEur.toFixed is not a
// function`, jer je tip ovde pogrešno pisao `number` a vrednost je zapravo bila string.
interface AIProviderQuota {
  id: string;
  providerName: string;
  period: string;
  quotaLimit: number | null;
  consumed: number;
  budgetLimitEur: string | null;
  consumedEur: string;
  enforcementState: string;
  degradedAt: string | null;
  periodStart: string;
  periodEnd: string;
  alertThresholdPercentage: number;
}

interface AIAgentBudget {
  id: string;
  agentId: string;
  period: string;
  budgetLimitEur: string;
  consumedEur: string;
  enforcementState: string;
  periodStart: string;
  periodEnd: string;
}

// M17 spec §4/§7 (Faza 7) — M18 §6.4/§6.5/§9. GET /ops/ai-provider-quota
// (M18/ai-provider-quota/VIEW), GET /ops/ai-agent-budgets (M18/ai-agent-budget/VIEW) — tvrd
// EUR budžet po provajderu i po agentu, sa DEGRADED stanjem (prisilan LIGHT model-tier dok se
// budžet ne resetuje ili ručno ne vrati preko OVERRIDE dozvole, spec §6.5).
export default async function NadzorAiTroskoviPage() {
  const me = await getMe();
  const canOverride = hasPermission(me, 'M18', 'ai-provider-quota', 'OVERRIDE');
  const canViewProviderQuota = hasPermission(me, 'M18', 'ai-provider-quota', 'VIEW');
  const canViewAgentBudget = hasPermission(me, 'M18', 'ai-agent-budget', 'VIEW');

  let providerQuotas: AIProviderQuota[] = [];
  let agentBudgets: AIAgentBudget[] = [];
  let error: string | null = null;

  try {
    if (canViewProviderQuota) {
      providerQuotas = await apiFetch<AIProviderQuota[]>('/ops/ai-provider-quota');
    }
    if (canViewAgentBudget) {
      agentBudgets = await apiFetch<AIAgentBudget[]>('/ops/ai-agent-budgets');
    }
    if (!canViewProviderQuota && !canViewAgentBudget) {
      error = 'Nemate dozvolu za uvid u AI troškove (M18/ai-provider-quota/VIEW ili M18/ai-agent-budget/VIEW).';
    }
  } catch {
    error = 'Učitavanje AI troškova nije uspelo.';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Nadzor — AI troškovi" />
      <div className="mb-4">
        <h1 className="font-mono text-lg">
          <span className="text-accent">$</span> nadzor/ai-troskovi/
        </h1>
        <p className="text-xs text-ink-dim">Potrošnja AI provajdera i pojedinačnih agenata naspram EUR budžeta — M18 spec §6.4/§6.5.</p>
      </div>

      <NadzorSubnav active="/nadzor/ai-troskovi" />

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && canViewProviderQuota && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-ink">Po AI provajderu</h2>
          <div className="mb-6 overflow-hidden rounded-lg border border-border">
            {providerQuotas.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema konfigurisanih kvota (spec §11 — ne pretpostavlja se unapred).</p>}
            {providerQuotas.map((q) => (
              <div key={q.id} className="border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-ink">
                    {q.providerName} <span className="text-xs text-ink-faint">({q.period})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <EnforcementBadge state={q.enforcementState} />
                    {canOverride && q.enforcementState === 'DEGRADED' && <OverrideQuotaButton id={q.id} />}
                  </div>
                </div>
                <div className="mt-1 text-xs text-ink-dim">
                  {q.budgetLimitEur != null ? (
                    <>
                      potrošeno <b className="text-ink">{Number(q.consumedEur).toFixed(4)}</b> / {Number(q.budgetLimitEur).toFixed(2)} EUR
                    </>
                  ) : (
                    <>potrošeno {Number(q.consumedEur).toFixed(4)} EUR (nema postavljen budget_limit_eur)</>
                  )}
                  {q.quotaLimit != null && (
                    <span className="ml-3">
                      · {q.consumed} / {q.quotaLimit} (prag upozorenja {q.alertThresholdPercentage}%)
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-ink-faint">
                  period {new Date(q.periodStart).toLocaleDateString('sr-RS')} – {new Date(q.periodEnd).toLocaleDateString('sr-RS')}
                  {q.degradedAt ? ` · degradiran ${new Date(q.degradedAt).toLocaleString('sr-RS')}` : ''}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!error && canViewAgentBudget && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-ink">Po agentu</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            {agentBudgets.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema konfigurisanih budžeta po agentu.</p>}
            {agentBudgets.map((b) => (
              <div key={b.id} className="border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-ink">
                    agent {b.agentId.slice(0, 8)}… <span className="text-xs text-ink-faint">({b.period})</span>
                  </div>
                  <EnforcementBadge state={b.enforcementState} />
                </div>
                <div className="mt-1 text-xs text-ink-dim">
                  potrošeno <b className="text-ink">{Number(b.consumedEur).toFixed(4)}</b> / {Number(b.budgetLimitEur).toFixed(2)} EUR
                </div>
                <div className="mt-1 text-[11px] text-ink-faint">
                  period {new Date(b.periodStart).toLocaleDateString('sr-RS')} – {new Date(b.periodEnd).toLocaleDateString('sr-RS')}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EnforcementBadge({ state }: { state: string }) {
  if (state === 'DEGRADED') return <Badge variant="danger">{state}</Badge>;
  return <Badge variant="ok">{state}</Badge>;
}
