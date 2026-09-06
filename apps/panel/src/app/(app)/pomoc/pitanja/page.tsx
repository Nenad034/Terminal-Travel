import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import HelpTabs from '../HelpTabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Pagination from '@/components/Pagination';


interface HelpQuestion {
  id: string;
  askedBy: string;
  audienceContext: 'STAFF' | 'SUBAGENT' | 'BUSINESS_CLIENT' | 'PUBLIC_GUEST';
  questionText: string;
  answerText: string | null;
  matchedArticleIds: string[];
  confidence: 'HIGH' | 'LOW' | 'NONE';
  wasHelpful: boolean | null;
  escalatedTicketId: string | null;
  createdAt: string;
}

const AUDIENCES = ['STAFF', 'SUBAGENT', 'BUSINESS_CLIENT', 'PUBLIC_GUEST'];
const CONFIDENCES = ['HIGH', 'LOW', 'NONE'];

// M17 spec §4/§7 (Faza 7) — M21 §3/§6 GET /help/questions (M21/question-log/VIEW, HR/Direktor/
// Vlasnik) — uvid u istoriju pitanja radi kvaliteta sadržaja i bezbednosnog pregleda (§3). Svaki
// red pokazuje odgovor, pouzdanost, koji su članci korišćeni (sledljivost, isto načelo kao M13
// "svaki izveštaj pokazuje izvor") i povratnu informaciju korisnika.
export default async function PitanjaPage(
  props: { searchParams: Promise<{ audienceContext?: string; confidence?: string; page?: string }> }
) {
  const searchParams = await props.searchParams;
  const me = await getMe();
  const showSuggestions = hasPermission(me, 'M21', 'suggestion', 'APPROVE');

  let questions: HelpQuestion[] = [];
  // Straničenje (6.9.2026, dok. 39 nalaz 2.2). Dnevnik pitanja postoji radi kvaliteta sadržaja
  // i bezbednosnog pregleda — pregled nad tiho odsečenom listom je gori od nikakvog, jer
  // ostavlja utisak da je pregledano sve.
  let total = 0;
  let page = 1;
  let pageCount = 1;
  let limit = 50;
  let error: string | null = null;
  try {
    const params = new URLSearchParams();
    if (searchParams?.audienceContext) params.set('audienceContext', searchParams.audienceContext);
    if (searchParams?.confidence) params.set('confidence', searchParams.confidence);
    if (searchParams?.page) params.set('page', searchParams.page);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const result = await apiFetch<{
      data: HelpQuestion[];
      total: number;
      page: number;
      pageCount: number;
      limit: number;
    }>(`/help/questions${qs}`);
    questions = result.data;
    total = result.total;
    page = result.page;
    pageCount = result.pageCount;
    limit = result.limit;
  } catch {
    error = 'Nemate dozvolu za uvid u istoriju pitanja (M21/question-log/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Pitanja AI asistentu" />
      <h1 className="mb-1 text-lg font-semibold text-ink">Pitanja AI asistentu</h1>

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
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            title="Filtriraj"
            className="h-9 w-9 border-transparent bg-brand p-0 text-brand-ink hover:bg-brand hover:brightness-90"
          >
            <Icon name="play" />
          </Button>
          {(searchParams?.audienceContext || searchParams?.confidence) && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/pomoc/pitanja">obriši filter</Link>
            </Button>
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
                <Badge variant="secondary" className="text-ink-dim">
                  {q.audienceContext}
                </Badge>
                <ConfidenceBadge confidence={q.confidence} />
                {q.wasHelpful === true && <Badge variant="ok">👍 korisno</Badge>}
                {q.wasHelpful === false && <Badge variant="danger">👎 nije korisno</Badge>}
                {q.escalatedTicketId && <Badge variant="warn">eskalirano → tiket {q.escalatedTicketId.slice(0, 8)}</Badge>}
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
          {/* Traka uvek ispisuje i UKUPAN broj pitanja, ne samo koja je strana. */}
          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            shown={questions.length}
            limit={limit}
            basePath="/pomoc/pitanja"
            searchParams={(searchParams ?? {}) as Record<string, string | string[] | undefined>}
            itemLabel="pitanja"
          />
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  if (confidence === 'HIGH') return <Badge variant="ok">{confidence}</Badge>;
  if (confidence === 'LOW') return <Badge variant="warn">{confidence}</Badge>;
  return <Badge variant="danger">{confidence}</Badge>;
}
