import Icon from '@/components/Icon';

interface Translation {
  languageCode: string;
  title: string;
  body: string;
  translationSource?: 'MANUAL' | 'AI_GENERATED';
}

// M23 spec §2.2/§2.4 — za razliku od M21, M23 nema PUT .../translations endpoint: sadržaj se
// upisuje isključivo pri kreiranju (translations[] u POST /articles) ili kroz odobrenje revizije
// (ArticleRevisionsService.approve upisuje proposed_translations kao stvarne redove, zamenjuje
// postojeće po jeziku, §2.4). Ovaj prikaz je zato namerno READ-ONLY — izmena ide preko
// /znanje/[id]/revizije, ne direktno odavde (nema backend endpoint-a za direktnu izmenu prevoda).
export default function TranslationsList({ translations }: { translations: Translation[] }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Icon name="globe" className="text-accent" /> Prevodi
      </div>

      {translations.length === 0 && <p className="text-xs text-ink-faint">Nema unetih prevoda — članak se ne može objaviti bez bar jednog (§2.1).</p>}

      <div className="flex flex-col gap-2">
        {translations.map((t) => (
          <div key={t.languageCode} className="rounded border border-border bg-panel2 p-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">{t.languageCode}</span>
              {t.translationSource && (
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${t.translationSource === 'AI_GENERATED' ? 'bg-warn-bg text-warn' : 'bg-panel text-ink-faint'}`}>
                  {t.translationSource}
                </span>
              )}
            </div>
            <p className="mt-1 font-medium text-ink">{t.title}</p>
            <p className="mt-1 whitespace-pre-wrap text-ink-dim">{t.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-ink-faint">
        Sadržaj se menja isključivo kroz odobrenu reviziju (kartica &quot;revizije&quot;) — nema direktnog uređivanja prevoda ovde (API nema takav endpoint u v1).
      </p>
    </div>
  );
}
