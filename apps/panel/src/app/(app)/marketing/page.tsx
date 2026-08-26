import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import TabLink from '@/components/TabLink';

interface ContentPiece {
  id: string;
  type: string;
  slug: string | null;
  targetChannels: string[];
  scheduledPublishAt: string | null;
  generatedBy: 'AI' | 'HUMAN';
  status: string;
  containsAiGeneratedMedia: boolean;
  translations: { languageCode: string; title: string }[];
}

const TYPES = ['BLOG_POST', 'SOCIAL_POST', 'EMAIL_NEWSLETTER', 'BANNER', 'STATIC_PAGE'];
const STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED'];

// M17 spec §4/§7 (Faza 6) — "Marketing sadržaj", M12 §7 GET /content ("kalendar = sortirano po
// scheduled_publish_at" — servis već sortira tako, ova lista je taj kalendar).
export default async function MarketingPage({ searchParams }: { searchParams: { type?: string; status?: string } }) {
  const me = await getMe();
  const canCreate = hasPermission(me, 'M12', 'content', 'CREATE_DRAFT');
  const canChannels = hasPermission(me, 'M12', 'channel-config', 'VIEW');

  let content: ContentPiece[] = [];
  let error: string | null = null;
  try {
    const params = new URLSearchParams();
    if (searchParams?.type) params.set('type', searchParams.type);
    if (searchParams?.status) params.set('status', searchParams.status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    content = await apiFetch<ContentPiece[]>(`/marketing/content${qs}`);
  } catch {
    error = 'Nemate dozvolu za uvid u marketinški sadržaj (M12/content/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Marketing sadržaj" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> ls marketing/sadrzaj/
          </h1>
          <p className="text-xs text-ink-dim">Proizvod → sadržaj → kalendar/odobrenje → distribucija na kanale — M12.</p>
        </div>
        <div className="flex gap-2">
          {canChannels && (
            <Link href="/marketing/kanali" className="flex items-center gap-1.5 rounded border border-border bg-panel px-3 py-1.5 text-xs font-medium text-ink-dim hover:border-accent">
              <Icon name="settings-gear" /> kanali
            </Link>
          )}
          {canCreate && (
            <Link href="/marketing/nov" className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong">
              <Icon name="add" /> nov sadržaj
            </Link>
          )}
        </div>
      </div>

      {!error && (
        <form className="mb-3 flex gap-2 text-xs" action="/marketing">
          <select name="type" defaultValue={searchParams?.type ?? ''} className="input">
            <option value="">svi tipovi</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={searchParams?.status ?? ''} className="input">
            <option value="">svi statusi</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-panel2 px-3 py-1.5 font-medium text-ink hover:bg-border">
            filtriraj
          </button>
          {(searchParams?.type || searchParams?.status) && (
            <Link href="/marketing" className="rounded px-3 py-1.5 font-medium text-ink-faint hover:text-ink">
              obriši filter
            </Link>
          )}
        </form>
      )}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          {content.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema sadržaja.</p>}
          {content.map((c) => {
            const title = c.translations.find((t) => t.languageCode === 'sr')?.title ?? c.translations[0]?.title ?? c.slug ?? '(bez naslova)';
            return (
              <TabLink
                key={c.id}
                href={`/marketing/${c.id}`}
                label={title}
                className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
              >
                <div>
                  <div className="font-medium text-ink">
                    {title}
                    {c.generatedBy === 'AI' && <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent-strong">AI nacrt</span>}
                    {c.containsAiGeneratedMedia && <span className="ml-2 rounded bg-warn-bg px-1.5 py-0.5 text-[11px] text-warn">AI vizual</span>}
                  </div>
                  <div className="text-xs text-ink-faint">
                    {c.type} · {c.targetChannels.join(', ') || '(bez kanala)'}
                    {c.scheduledPublishAt && ` · zakazano ${new Date(c.scheduledPublishAt).toLocaleString('sr-RS')}`}
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </TabLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === 'PUBLISHED' ? 'text-ok bg-ok-bg' : status === 'APPROVED' ? 'text-accent-strong bg-accent-soft' : 'text-warn bg-warn-bg';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{status}</span>;
}
