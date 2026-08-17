import { redirect } from 'next/navigation';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import NewArticleForm from './NewArticleForm';

const SEGMENTS: { value: 'STAFF' | 'SUBAGENT' | 'BUSINESS_CLIENT' | 'PUBLIC_GUEST'; segment: 'staff' | 'subagent' | 'business' | 'public'; label: string }[] = [
  { value: 'STAFF', segment: 'staff', label: 'STAFF (interni tim)' },
  { value: 'SUBAGENT', segment: 'subagent', label: 'SUBAGENT (B2B portal)' },
  { value: 'BUSINESS_CLIENT', segment: 'business', label: 'BUSINESS_CLIENT (korporativni self-service)' },
  { value: 'PUBLIC_GUEST', segment: 'public', label: 'PUBLIC_GUEST (anonimni/pojedinačni B2C gosti)' },
];

// M21 spec §2.1/§6 — POST /help/articles zahteva EDIT dozvolu za SVAKI audience segment koji se
// šalje. Ovaj ekran nudi samo segmente za koje pozivalac stvarno ima EDIT (§3) — ostatak se ne
// nudi da forma ne baca 403 na segment koji korisnik ne sme da dodeli.
export default async function NoviClanakPage() {
  const me = await getMe();
  const allowedSegments = SEGMENTS.filter((s) => hasPermission(me, 'M21', `article:${s.segment}`, 'EDIT'));
  if (allowedSegments.length === 0) redirect('/pomoc');

  return (
    <div className="mx-auto max-w-2xl p-6">
      <RegisterTab label="Nov članak" />
      <h1 className="mb-1 font-mono text-lg">
        <span className="text-accent">$</span> pomoc/clanci/nov
      </h1>
      <p className="mb-4 text-xs text-ink-dim">Kreira se kao DRAFT — prevod (naslov/tekst) se dodaje na sledećoj stranici (M21 spec §2.2).</p>
      <NewArticleForm allowedAudience={allowedSegments.map((s) => s.value)} />
    </div>
  );
}
