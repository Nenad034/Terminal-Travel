import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import TabLink from '@/components/TabLink';
import HelpTabs from './HelpTabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';


interface HelpArticleRow {
  id: string;
  slug: string;
  audience: string[];
  relatedModule: string | null;
  isCriticalExample: boolean;
  status: string;
  generatedBy: 'AI' | 'HUMAN';
  approvedBy: string | null;
  publishedAt: string | null;
  translation: { languageCode: string; title: string; body: string } | null;
}

const SEGMENTS: { segment: 'staff' | 'subagent' | 'business' }[] = [{ segment: 'staff' }, { segment: 'subagent' }, { segment: 'business' }];
const LANGUAGES = ['sr', 'en', 'hr', 'sl', 'es', 'de', 'ru', 'fr'];

const STATUS_OPTIONS = ['PUBLISHED', 'DRAFT', 'PENDING_APPROVAL', 'ARCHIVED'];

// M17 spec §4/§7 (Faza 7, rešeno M17 Faza 7 zatvaranje nedostataka) — M21 §6 GET /help/articles:
// publika je UVEK izvedena uživo iz naloga koji poziva (nema audience query parametra, §3), ali
// `status` je opcion query parametar — za nekog sa EDIT dozvolom (bar jedan audience segment) sme
// da traži i DRAFT/PENDING_APPROVAL/ARCHIVED, ograničeno na segmente za koje ima EDIT (ne tuđe
// DRAFT-ove); bez EDIT dozvole parametar se tiho ignoriše (HelpArticlesService.findVisibleToCaller).
// Podrazumevani filter ostaje PUBLISHED za sve — status selektor se prikazuje samo uređivačima.
export default async function PomocPage(
  props: {
    searchParams: Promise<{ relatedModule?: string; isCriticalExample?: string; lang?: string; status?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const me = await getMe();
  const canCreate = SEGMENTS.some((s) => hasPermission(me, 'M21', `article:${s.segment}`, 'EDIT'));
  const showSuggestions = hasPermission(me, 'M21', 'suggestion', 'APPROVE');
  const showQuestions = hasPermission(me, 'M21', 'question-log', 'VIEW');
  const status = searchParams?.status && STATUS_OPTIONS.includes(searchParams.status) ? searchParams.status : undefined;

  let articles: HelpArticleRow[] = [];
  let error: string | null = null;
  try {
    const params = new URLSearchParams();
    if (searchParams?.relatedModule) params.set('relatedModule', searchParams.relatedModule);
    if (searchParams?.isCriticalExample) params.set('isCriticalExample', searchParams.isCriticalExample);
    if (searchParams?.lang) params.set('lang', searchParams.lang);
    if (canCreate && status) params.set('status', status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    articles = await apiFetch<HelpArticleRow[]>(`/help/articles${qs}`);
  } catch {
    error = 'Nemate dozvolu za uvid u Centar za pomoć (M21/article:*/VIEW) ili vaš nalog nema rešivu publiku (§1/§7).';
  }

  const critical = articles.filter((a) => a.isCriticalExample);
  const regular = articles.filter((a) => !a.isCriticalExample);

  return (
    <div className="p-6">
      <RegisterTab label="Centar za pomoć" />
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Centar za pomoć</h1>
        </div>
        {canCreate && (
          <Button asChild size="sm">
            <Link href="/pomoc/nov" className="flex items-center gap-1.5">
              <Icon name="add" /> nov članak
            </Link>
          </Button>
        )}
      </div>

      <HelpTabs active="clanci" showSuggestions={showSuggestions} showQuestions={showQuestions} />

      {!error && (
        <form className="mb-3 flex flex-wrap items-center gap-2 text-xs" action="/pomoc">
          <input name="relatedModule" defaultValue={searchParams?.relatedModule ?? ''} placeholder="modul (npr. M5)" className="input" />
          <select name="lang" defaultValue={searchParams?.lang ?? ''} className="input">
            <option value="">svi jezici</option>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          {canCreate && (
            <select name="status" defaultValue={status ?? ''} className="input" title="Nacrte/na čekanju vidite samo za publiku za koju imate EDIT dozvolu (M21 §3).">
              <option value="">objavljeno</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase()}
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-1.5 text-ink-dim">
            <input type="checkbox" name="isCriticalExample" value="true" defaultChecked={searchParams?.isCriticalExample === 'true'} className="h-3.5 w-3.5" />
            samo kritični primeri
          </label>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            title="Filtriraj"
            className="h-9 w-9 border-transparent bg-brand p-0 text-brand-ink hover:bg-brand hover:brightness-90"
          >
            <Icon name="arrow-right" />
          </Button>
          {(searchParams?.relatedModule || searchParams?.lang || searchParams?.isCriticalExample || status) && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/pomoc">obriši filter</Link>
            </Button>
          )}
        </form>
      )}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <>
          <ArticleGroup
            title="Kritični primeri — korak-po-korak radni scenariji"
            hint="§4 — rešavaju konkretnu situaciju od početka do kraja, prioritet u pretrazi i u AI odgovorima."
            articles={critical}
            emptyText="Nema kritičnih primera."
            accent
          />
          <ArticleGroup title="Ostali članci" articles={regular} emptyText="Nema opisnih članaka." />
        </>
      )}
    </div>
  );
}

function ArticleGroup({
  title,
  hint,
  articles,
  emptyText,
  accent,
}: {
  title: string;
  hint?: string;
  articles: HelpArticleRow[];
  emptyText: string;
  accent?: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5">
        <h2 className={`text-xs font-semibold ${accent ? 'text-accent' : 'text-ink-dim'}`}>{title}</h2>
        {hint && <p className="text-[11px] text-ink-faint">{hint}</p>}
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        {articles.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">{emptyText}</p>}
        {articles.map((a) => (
          <TabLink
            key={a.id}
            href={`/pomoc/${a.id}`}
            label={a.translation?.title ?? a.slug}
            className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
          >
            <div>
              <div className="font-medium text-ink">
                {a.translation?.title ?? a.slug}
                {a.isCriticalExample && (
                  <Badge variant="secondary" className="ml-2 bg-accent-soft text-accent-strong">
                    kritičan primer
                  </Badge>
                )}
                {a.generatedBy === 'AI' && (
                  <Badge variant="warn" className="ml-2">
                    AI nacrt
                  </Badge>
                )}
              </div>
              <div className="text-xs text-ink-faint">
                {a.audience.join(', ')} · {a.relatedModule ?? '(bez modula)'} · {a.translation?.languageCode ?? '—'}
              </div>
            </div>
            <StatusBadge status={a.status} />
          </TabLink>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'PUBLISHED') return <Badge variant="ok">{status}</Badge>;
  if (status === 'ARCHIVED') return (
    <Badge variant="secondary" className="text-ink-faint">
      {status}
    </Badge>
  );
  return <Badge variant="warn">{status}</Badge>;
}
