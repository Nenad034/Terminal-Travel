import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import HelpTabs from '../HelpTabs';

interface HelpQuestion {
  id: string;
  askedBy: string;
  audienceContext: 'STAFF' | 'SUBAGENT' | 'BUSINESS_CLIENT';
  questionText: string;
  answerText: string | null;
  matchedArticleIds: string[];
  confidence: 'HIGH' | 'LOW' | 'NONE';
  wasHelpful: boolean | null;
  escalatedTicketId: string | null;
  createdAt: string;
}

const AUDIENCES = ['STAFF', 'SUBAGENT', 'BUSINESS_CLIENT'];
const CONFIDENCES = ['HIGH', 'LOW', 'NONE'];

// M17 spec §4/§7 (Faza 7) — M21 §3/§6 GET /help/questions (M21/question-log/VIEW, HR/Direktor/
// Vlasnik) — uvid u istoriju pitanja radi kvaliteta sadržaja i bezbednosnog pregleda (§3). Svaki
// red pokazuje odgovor, pouzdanost, koji su članci korišćeni (sledljivost, isto načelo kao M13
// "svaki izveštaj pokazuje izvor") i povratnu informaciju korisnika.
export default async function PitanjaPage({ searchParams }: { searchParams: { audienceContext?: string; confidence?: string } }) {
  const me = await getMe();
  const showSuggestions = hasPermission(me, 'M21', 'suggestion', 'APPROVE');

  let questions: HelpQuestion[] = [];
  let error: string | null = null;
  try {
    const params = new URLSearchParams();
    if (searchParams?.audienceContext) params.set('audienceContext', searchParams.audienceContext);
    if (searchParams?.confidence) params.set('confidence', searchParams.confidence);
    const qs = params.toString() ? `?${params.toString()}` : '';
    questions = await apiFetch<HelpQuestion[]>(`/help/questions${qs}`);
  } catch {
    error = 'Nemate dozvolu za uvid u istoriju pitanja (M21/question-log/VIEW).';
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <RegisterTab label="Pitanja AI asistentu" />
      <h1 className="mb-1 font-mono text-lg">
        <span className="text-accent">$</span> ls pomoc/pitanja/
      </h1>
      <p className="mb-2 text-xs text-ink-dim">Log svakog pitanja postavljenog AI asistentu (§2.3) — kvalitet sadržaja i bezbednosni pregled.</p>

      <HelpTabs active="pitanja" showSuggestions={showSuggestions} showQuestions />

      {!error && (
        <form className="mb-3 flex flex-wrap gap-2 text-xs" action="/pomoc/pitanja">
          <select name="audienceContext" defaultValue={searchParams?.audienceContext ?? ''} className="input">
            <option value="">sve publike</option>
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select name="confidence" defaultValue={searchParams?.confidence ?? ''} className="input">
            <option value="">sva pouzdanost</option>
            {CONFIDENCES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-panel2 px-3 py-1.5 font-medium text-ink hover:bg-border">
            filtriraj
          </button>
          {(searchParams?.audienceContext || searchParams?.confidence) && (
            <Link href="/pomoc/pitanja" className="rounded px-3 py-1.5 font-medium text-ink-faint hover:text-ink">
              obriši filter
            </Link>
          )}
        </form>
      )}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="flex flex-col gap-3">
          {questions.length === 0 && <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-ink-faint">Nema pitanja.</p>}
          {questions.map((q) => (
            <div key={q.id} className="rounded-lg border border-border bg-panel p-4 text-xs">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-ink">{q.questionText}</span>
                <span className="text-[11px] text-ink-faint">{new Date(q.createdAt).toLocaleString('sr-RS')}</span>
              </div>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-ink-dim">{q.audienceContext}</span>
                <ConfidenceBadge confidence={q.confidence} />
                {q.wasHelpful === true && <span className="rounded bg-ok-bg px-1.5 py-0.5 text-[10px] text-ok">👍 korisno</span>}
                {q.wasHelpful === false && <span className="rounded bg-danger-bg px-1.5 py-0.5 text-[10px] text-danger">👎 nije korisno</span>}
                {q.escalatedTicketId && (
                  <span className="rounded bg-warn-bg px-1.5 py-0.5 text-[10px] text-warn">eskalirano → tiket {q.escalatedTicketId.slice(0, 8)}</span>
                )}
              </div>
              {q.answerText ? (
                <p className="whitespace-pre-wrap text-ink-dim">{q.answerText}</p>
              ) : (
                <p className="italic text-ink-faint">(agent nije dao pouzdan odgovor)</p>
              )}
              {q.matchedArticleIds.length > 0 && (
                <p className="mt-2 text-[11px] text-ink-faint">
                  korišćeni članci:{' '}
                  {q.matchedArticleIds.map((id, i) => (
                    <span key={id}>
                      {i > 0 && ', '}
                      <Link href={`/pomoc/${id}`} className="text-accent hover:underline">
                        {id.slice(0, 8)}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const tone = confidence === 'HIGH' ? 'text-ok bg-ok-bg' : confidence === 'LOW' ? 'text-warn bg-warn-bg' : 'text-danger bg-danger-bg';
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{confidence}</span>;
}
