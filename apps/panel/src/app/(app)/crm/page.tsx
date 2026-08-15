import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';

interface ClientAccount {
  id: string;
  accountType: 'INDIVIDUAL' | 'LEGAL_ENTITY';
  fullName: string | null;
  companyName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  tags: string[] | null;
  marketingConsent: boolean;
}

// M17 spec §4/§7 (Faza 3) — "Gosti i nalogodavci (CRM)", M6 §9 GET /client-accounts
// (filtrirano po email/taxId — jedini pretražljivi filter koji API podržava jeftino).
// Gosti (GuestProfile) žive na /crm/gosti, ankete posle putovanja na /crm/ankete — isti
// obrazac razdvajanja resursa unutar jedne nav stavke kao "Dobavljači i ugovori" (M3).
export default async function CrmPage({ searchParams }: { searchParams: { email?: string; taxId?: string } }) {
  const me = await getMe();
  const canCreate = hasPermission(me, 'M6', 'client-account', 'CREATE');
  const canViewGuests = hasPermission(me, 'M6', 'guest-profile', 'VIEW');
  const canViewSurveys = hasPermission(me, 'M6', 'post-trip-survey', 'VIEW');

  let accounts: ClientAccount[] = [];
  let error: string | null = null;
  try {
    const params = new URLSearchParams();
    if (searchParams?.email) params.set('email', searchParams.email);
    if (searchParams?.taxId) params.set('taxId', searchParams.taxId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    accounts = await apiFetch<ClientAccount[]>(`/crm/client-accounts${qs}`);
  } catch {
    error = 'Nemate dozvolu za uvid u nalogodavce (M6/client-account/VIEW).';
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <RegisterTab label="Gosti i nalogodavci (CRM)" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> ls crm/nalogodavci/
          </h1>
          <p className="text-xs text-ink-dim">Profili nalogodavaca (ko plaća), istorija putovanja, lojalnost, komunikacija — M6.</p>
        </div>
        <div className="flex gap-2">
          {canViewSurveys && (
            <Link href="/crm/ankete" className="flex items-center gap-1.5 rounded border border-border bg-panel px-3 py-1.5 text-xs font-medium text-ink-dim hover:border-accent">
              <Icon name="star" /> ankete
            </Link>
          )}
          {canViewGuests && (
            <Link href="/crm/gosti" className="flex items-center gap-1.5 rounded border border-border bg-panel px-3 py-1.5 text-xs font-medium text-ink-dim hover:border-accent">
              <Icon name="account" /> gosti
            </Link>
          )}
          {canCreate && (
            <Link href="/crm/novi" className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong">
              <Icon name="add" /> novi nalogodavac
            </Link>
          )}
        </div>
      </div>

      {!error && (
        <form className="mb-3 flex gap-2 text-xs" action="/crm">
          <input name="email" defaultValue={searchParams?.email ?? ''} placeholder="pretraga po email-u" className="input flex-1" />
          <input name="taxId" defaultValue={searchParams?.taxId ?? ''} placeholder="pretraga po PIB-u" className="input flex-1" />
          <button type="submit" className="rounded bg-panel2 px-3 py-1.5 font-medium text-ink hover:bg-border">
            traži
          </button>
          {(searchParams?.email || searchParams?.taxId) && (
            <Link href="/crm" className="rounded px-3 py-1.5 font-medium text-ink-faint hover:text-ink">
              obriši filter
            </Link>
          )}
        </form>
      )}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          {accounts.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema nalogodavaca.</p>}
          {accounts.map((a) => (
            <Link
              key={a.id}
              href={`/crm/${a.id}`}
              className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
            >
              <div>
                <div className="font-medium text-ink">
                  {a.accountType === 'LEGAL_ENTITY' ? a.companyName : a.fullName}
                  {a.accountType === 'LEGAL_ENTITY' && <span className="ml-2 text-[10px] text-ink-faint">PRAVNO LICE{a.taxId ? ` · PIB ${a.taxId}` : ''}</span>}
                </div>
                <div className="text-xs text-ink-faint">
                  {a.email ?? '—'} {a.phone ? `· ${a.phone}` : ''}
                </div>
                {a.tags && a.tags.length > 0 && (
                  <div className="mt-1 flex gap-1">
                    {a.tags.map((t) => (
                      <span key={t} className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-ink-faint">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {!a.marketingConsent && <span className="text-[10px] text-ink-faint">bez marketing saglasnosti</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
