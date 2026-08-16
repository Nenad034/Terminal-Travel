import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import HelpTabs from '../HelpTabs';
import SuggestionActions from './SuggestionActions';

interface Suggestion {
  id: string;
  basedOnQuestionIds: string[];
  draftTitle: string;
  draftBody: string;
  status: string;
  createdAt: string;
}

// M17 spec §4/§7 (Faza 7) — M21 §5.4/§6 GET /help/suggestions (M21/suggestion/APPROVE, HR/
// Direktor/Vlasnik). Nastaju automatski (dnevni cron 6h) kad se nagomilaju ponovljena
// NONE/LOW/negativno-ocenjena pitanja na istu temu (§5.4, prag 3+ u 30 dana). Odobravanje kreira
// stvaran HelpArticle(PENDING_APPROVAL) koji i dalje čeka sopstveni korak objavljivanja.
export default async function PredloziPage() {
  const me = await getMe();
  const showQuestions = hasPermission(me, 'M21', 'question-log', 'VIEW');
  const canReview = hasPermission(me, 'M21', 'suggestion', 'APPROVE');

  let suggestions: Suggestion[] = [];
  let error: string | null = null;
  try {
    suggestions = await apiFetch<Suggestion[]>('/help/suggestions');
  } catch {
    error = 'Nemate dozvolu za uvid u predloge (M21/suggestion/APPROVE).';
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <RegisterTab label="Predlozi članaka" />
      <h1 className="mb-1 font-mono text-lg">
        <span className="text-accent">$</span> ls pomoc/predlozi/
      </h1>
      <p className="mb-2 text-xs text-ink-dim">
        AI nacrti nastali iz ponovljenih pitanja bez dobrog odgovora (§5.4) — odobravanje kreira nacrt članka koji i dalje čeka sopstveno objavljivanje.
      </p>

      <HelpTabs active="predlozi" showSuggestions={canReview} showQuestions={showQuestions} />

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="flex flex-col gap-3">
          {suggestions.length === 0 && <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-ink-faint">Nema predloga na čekanju.</p>}
          {suggestions.map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-panel p-4">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">{s.draftTitle}</h2>
                <span className="text-[11px] text-ink-faint">{new Date(s.createdAt).toLocaleString('sr-RS')}</span>
              </div>
              <p className="mb-2 whitespace-pre-wrap text-xs text-ink-dim">{s.draftBody}</p>
              <p className="mb-3 text-[11px] text-ink-faint">
                zasnovano na {s.basedOnQuestionIds.length} pitanj{s.basedOnQuestionIds.length === 1 ? 'u' : 'a'} (§5.4)
              </p>
              {canReview && <SuggestionActions id={s.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
