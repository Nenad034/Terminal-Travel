import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import ActorLabel from '@/components/ActorLabel';
import TranslationsPanel from './TranslationsPanel';
import ApproveContentButton from './ApproveContentButton';

interface ContentPiece {
  id: string;
  productId: string | null;
  type: string;
  slug: string | null;
  trackingCode: string;
  targetChannels: string[];
  targetTags: string[] | null;
  containsAiGeneratedMedia: boolean;
  scheduledPublishAt: string | null;
  generatedBy: 'AI' | 'HUMAN';
  approvedBy: string | null;
  publishedAt: string | null;
  status: string;
  translations: { languageCode: string; title: string; body: string; isReviewed: boolean }[];
}

// M17 spec §4/§7 (Faza 6) — detalj sadržaja: metapodaci, prevodi (M12 §2.2), odobrenje (§3
// korak 4, M12/content/APPROVE_PUBLISH). tracking_code (§3a) prikazan radi lakšeg poklapanja
// sa M13 marketing izveštajem, ne menja se ovde (generiše se automatski pri kreiranju).
export default async function ContentDetailPage({ params }: { params: { id: string } }) {
  const me = await getMe();
  const canApprove = hasPermission(me, 'M12', 'content', 'APPROVE_PUBLISH');
  const canEdit = hasPermission(me, 'M12', 'content', 'CREATE_DRAFT');

  let content: ContentPiece;
  try {
    content = await apiFetch<ContentPiece>(`/marketing/content/${params.id}`);
  } catch {
    notFound();
  }

  const canApproveNow = canApprove && (content.status === 'DRAFT' || content.status === 'PENDING_APPROVAL');

  return (
    <div className="mx-auto max-w-4xl p-6">
      <RegisterTab label={content.slug ?? content.trackingCode} />
      <Link href="/marketing" className="mb-3 inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink">
        <Icon name="arrow-left" /> nazad na listu
      </Link>

      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> marketing/sadrzaj/{content.slug ?? content.id.slice(0, 8)}
          </h1>
          {/* 29-DIZAJN-SISTEM-UI.md §6a — autor nacrta kao i svuda drugde; odobrenje objave
              (approvedBy, §3 korak 4) ostaje isključivo ljudsko i prikazano je posebno ispod. */}
          <p className="flex flex-wrap items-center gap-1 text-xs text-ink-faint">
            {content.type} · tracking_code <code>{content.trackingCode}</code> ·{' '}
            {content.generatedBy === 'AI' ? (
              <ActorLabel name="AI agent" origin="AI_AGENT" />
            ) : (
              <ActorLabel name="ručni unos" origin="STAFF" />
            )}
          </p>
        </div>
        <StatusBadge status={content.status} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-border bg-panel p-4 text-xs">
        <Info label="ciljni kanali" value={content.targetChannels.join(', ') || '—'} />
        <Info label="zakazana objava" value={content.scheduledPublishAt ? new Date(content.scheduledPublishAt).toLocaleString('sr-RS') : '—'} />
        <Info label="proizvod (M2)" value={content.productId ?? '(opšti sadržaj)'} />
        <Info label="oznake (EMAIL)" value={content.targetTags?.join(', ') || '—'} />
        <Info label="objavljeno" value={content.publishedAt ? new Date(content.publishedAt).toLocaleString('sr-RS') : '—'} />
        <Info label="odobrio" value={content.approvedBy ?? '—'} />
      </div>

      {content.containsAiGeneratedMedia && (
        <p className="mb-4 rounded-lg border border-warn bg-warn-bg p-3 text-xs text-warn">
          <Icon name="warning" /> Sadrži sintetički AI-generisan vizual (YUTA preporuka, M12 spec §3c) — pri odobrenju je obavezna vidljiva oznaka
          transparentnosti u tekstu jezika objave.
        </p>
      )}

      {canApproveNow && (
        <div className="mb-4">
          <ApproveContentButton id={content.id} />
        </div>
      )}

      <TranslationsPanel
        contentId={content.id}
        translations={content.translations}
        canEdit={canEdit && content.status !== 'PUBLISHED'}
      />
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
  const tone = status === 'PUBLISHED' ? 'text-ok bg-ok-bg' : status === 'APPROVED' ? 'text-accent bg-accent-soft' : 'text-warn bg-warn-bg';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{status}</span>;
}
