import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import TranslationsPanel from './TranslationsPanel';
import PublishButton from './PublishButton';
import StatusForm from './StatusForm';

interface Translation {
  languageCode: string;
  title: string;
  body: string;
}

interface HelpArticleDetail {
  id: string;
  slug: string;
  audience: ('STAFF' | 'SUBAGENT' | 'BUSINESS_CLIENT')[];
  relatedModule: string | null;
  isCriticalExample: boolean;
  status: string;
  generatedBy: 'AI' | 'HUMAN';
  approvedBy: string | null;
  publishedAt: string | null;
  translation: Translation | null;
}

const AUDIENCE_TO_SEGMENT: Record<string, 'staff' | 'subagent' | 'business'> = {
  STAFF: 'staff',
  SUBAGENT: 'subagent',
  BUSINESS_CLIENT: 'business',
};
const LANGUAGES = ['sr', 'en', 'hr', 'sl', 'es', 'de', 'ru', 'fr'];

// M17 spec §4/§7 (Faza 7) — M21 §6 GET /help/articles/:id. Uređivač (EDIT za bar jedan audience
// segment) vidi članak u BILO KOM statusu; ostali samo ako je PUBLISHED i publika se poklapa —
// inače 404, ne 403 (isto načelo kao M19 razgovori — nevidljivo, ne samo zabranjeno).
//
// NAPOMENA (implementaciona, ne menja backend): HelpArticlesService.findOne (za razliku od M12
// ContentService.findOne) vraća JEDAN rešeni prevod (`translation`), ne punu listu svih prevoda
// članka — isti fallback-kolaps kao GET /help/articles lista (spec §2.2). Da bi ekran mogao da
// prikaže/uređuje SVAKI postojeći jezik posebno (isti UI princip kao M12 TranslationsPanel), ova
// stranica poziva findOne jednom po svakom podržanom jezičkom kodu i zadržava samo one odgovore
// gde se `translation.languageCode` tačno poklapa sa traženim (rezultat fallback-a se prepoznaje
// po tome što vraća DRUGI jezik od traženog) — otkriva stvaran skup postojećih prevoda bez ijedne
// izmene backend ugovora. Vidi izveštaj sesije za predlog da se ovo doda kao pravi backend
// endpoint (GET /help/articles/:id/translations, isti obrazac kao M12) u budućem potvrđenom prolazu.
export default async function HelpArticleDetailPage({ params }: { params: { id: string } }) {
  const me = await getMe();

  const perLang = await Promise.all(
    LANGUAGES.map((lang) =>
      apiFetch<HelpArticleDetail>(`/help/articles/${params.id}?lang=${lang}`).catch(() => null),
    ),
  );

  const article = perLang.find((r) => r !== null);
  if (!article) notFound();

  // Zadržava prevod za jezik `lang` SAMO ako je vraćeni `translation.languageCode` tačno taj
  // jezik (znak da je zaista nađen, ne fallback rezultat) — vidi napomenu iznad.
  const realTranslations: Translation[] = LANGUAGES.map((lang, i) =>
    perLang[i]?.translation?.languageCode === lang ? perLang[i]!.translation! : null,
  ).filter((t): t is Translation => !!t);

  const canEdit = article.audience.some((a) => hasPermission(me, 'M21', `article:${AUDIENCE_TO_SEGMENT[a]}`, 'EDIT'));
  const canPublish = article.audience.some((a) => hasPermission(me, 'M21', `article:${AUDIENCE_TO_SEGMENT[a]}`, 'PUBLISH'));

  return (
    <div className="mx-auto max-w-4xl p-6">
      <RegisterTab label={article.slug} />
      <Link href="/pomoc" className="mb-3 inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink">
        <Icon name="arrow-left" /> nazad na listu
      </Link>

      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> pomoc/clanci/{article.slug}
          </h1>
          <p className="text-xs text-ink-faint">
            {article.audience.join(', ')} · {article.relatedModule ?? '(bez modula)'} · {article.generatedBy === 'AI' ? 'AI nacrt' : 'ručni unos'}
            {article.isCriticalExample && <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent">kritičan primer</span>}
          </p>
        </div>
        <StatusBadge status={article.status} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-border bg-panel p-4 text-xs">
        <Info label="objavljeno" value={article.publishedAt ? new Date(article.publishedAt).toLocaleString('sr-RS') : '—'} />
        <Info label="odobrio (approved_by)" value={article.approvedBy ?? '—'} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {canPublish && article.status !== 'PUBLISHED' && <PublishButton id={article.id} />}
        {canEdit && article.status !== 'PUBLISHED' && <StatusForm id={article.id} status={article.status} />}
      </div>

      {article.status === 'PUBLISHED' && (
        <p className="mb-4 rounded-lg border border-border bg-panel2 p-3 text-xs text-ink-faint">
          Objavljen članak (nepovratna granica, M21 spec §2.1) — status se više ne menja sa ovog ekrana.
        </p>
      )}

      <TranslationsPanel articleId={article.id} translations={realTranslations} canEdit={canEdit && article.status !== 'PUBLISHED'} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-ink-faint">{label}</div>
      <div className="mt-0.5 text-ink">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === 'PUBLISHED' ? 'text-ok bg-ok-bg' : status === 'ARCHIVED' ? 'text-ink-faint bg-panel2' : 'text-warn bg-warn-bg';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{status}</span>;
}
