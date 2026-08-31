import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import TabLink from '@/components/TabLink';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';


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
export default async function CrmPage(props: { searchParams: Promise<{ email?: string; taxId?: string }> }) {
  const searchParams = await props.searchParams;
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
    <div className="p-6">
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
            <Button asChild variant="outline" size="sm">
              <Link href="/crm/ankete" className="flex items-center gap-1.5">
                <Icon name="star" /> ankete
              </Link>
            </Button>
          )}
          {canViewGuests && (
            <Button asChild variant="outline" size="sm">
              <Link href="/crm/gosti" className="flex items-center gap-1.5">
                <Icon name="account" /> gosti
              </Link>
            </Button>
          )}
          {canCreate && (
            <Button asChild size="sm">
              <Link href="/crm/novi" className="flex items-center gap-1.5">
                <Icon name="add" /> novi nalogodavac
              </Link>
            </Button>
          )}
        </div>
      </div>

      {!error && (
        <form className="mb-3 flex gap-2 text-xs" action="/crm">
          <input name="email" defaultValue={searchParams?.email ?? ''} placeholder="pretraga po email-u" className="input flex-1" />
          <input name="taxId" defaultValue={searchParams?.taxId ?? ''} placeholder="pretraga po PIB-u" className="input flex-1" />
          <Button type="submit" variant="secondary" size="sm">
            traži
          </Button>
          {(searchParams?.email || searchParams?.taxId) && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/crm">obriši filter</Link>
            </Button>
          )}
        </form>
      )}

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-border">
          {accounts.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema nalogodavaca.</p>}
          {accounts.map((a) => {
            const name = (a.accountType === 'LEGAL_ENTITY' ? a.companyName : a.fullName) || 'Nalogodavac';
            return (
              <TabLink
                key={a.id}
                href={`/crm/${a.id}`}
                label={name}
                className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
              >
                <div>
                  <div className="font-medium text-ink">
                    {name}
                    {a.accountType === 'LEGAL_ENTITY' && <span className="ml-2 text-[11px] text-ink-faint">PRAVNO LICE{a.taxId ? ` · PIB ${a.taxId}` : ''}</span>}
                  </div>
                  <div className="text-xs text-ink-faint">
                    {a.email ?? '—'} {a.phone ? `· ${a.phone}` : ''}
                  </div>
                  {a.tags && a.tags.length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {a.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-ink-faint">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                {!a.marketingConsent && <span className="text-xs text-ink-faint">bez marketing saglasnosti</span>}
              </TabLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
