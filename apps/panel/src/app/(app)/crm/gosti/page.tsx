import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import TabLink from '@/components/TabLink';
import { Button } from '@/components/ui/button';

interface GuestProfile {
  id: string;
  fullName: string;
  documentType: 'PASSPORT' | 'LICNA_KARTA';
  documentNumber: string;
  nationality: string;
  email: string | null;
  phone: string | null;
  linkedClientAccountId: string | null;
}

// M6 spec §2.2, §9 — GET /guest-profiles (opciono filtrirano po linkedClientAccountId).
export default async function GuestProfilesPage({ searchParams }: { searchParams: { linkedClientAccountId?: string } }) {
  const me = await getMe();
  const canCreate = hasPermission(me, 'M6', 'guest-profile', 'CREATE');

  let guests: GuestProfile[] = [];
  let error: string | null = null;
  try {
    const qs = searchParams?.linkedClientAccountId ? `?linkedClientAccountId=${encodeURIComponent(searchParams.linkedClientAccountId)}` : '';
    guests = await apiFetch<GuestProfile[]>(`/crm/guest-profiles${qs}`);
  } catch {
    error = 'Nemate dozvolu za uvid u profile gostiju (M6/guest-profile/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Gosti" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> ls crm/gosti/
          </h1>
          <p className="text-xs text-ink-dim">Profili gostiju (ko putuje) — dokument, preference, istorija putovanja.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/crm" className="flex items-center gap-1.5">
              <Icon name="organization" /> nalogodavci
            </Link>
          </Button>
          {canCreate && (
            <Button asChild size="sm">
              <Link href="/crm/gosti/novi" className="flex items-center gap-1.5">
                <Icon name="add" /> novi gost
              </Link>
            </Button>
          )}
        </div>
      </div>

      {searchParams?.linkedClientAccountId && (
        <p className="mb-3 text-xs text-ink-faint">
          filtrirano po nalogodavcu{' '}
          <Link href={`/crm/${searchParams.linkedClientAccountId}`} className="text-accent hover:underline">
            {searchParams.linkedClientAccountId.slice(0, 8)}…
          </Link>{' '}
          · <Link href="/crm/gosti" className="text-ink-faint hover:text-ink">obriši filter</Link>
        </p>
      )}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          {guests.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema profila gostiju.</p>}
          {guests.map((g) => (
            <TabLink
              key={g.id}
              href={`/crm/gosti/${g.id}`}
              label={g.fullName}
              className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
            >
              <div>
                <div className="font-medium text-ink">{g.fullName}</div>
                <div className="text-xs text-ink-faint">
                  {g.documentType} {g.documentNumber} · {g.nationality}
                </div>
              </div>
              <div className="text-xs text-ink-faint">{g.email ?? g.phone ?? '—'}</div>
            </TabLink>
          ))}
        </div>
      )}
    </div>
  );
}
