import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import NewSubagentForm from './NewSubagentForm';


interface ClientAccountSummary {
  id: string;
  accountType: 'INDIVIDUAL' | 'LEGAL_ENTITY';
  companyName: string | null;
  taxId: string | null;
  email: string | null;
}

// M7 spec §2.1/§11 — POST /subagents zahteva postojeći ClientAccount sa
// account_type = LEGAL_ENTITY (M6). Nema poseban M6 endpoint za filter po accountType (samo
// email/taxId, isti kao CRM lista), pa se ovde traži nalogodavac preko istog filtera kao
// /crm, a rezultat se suzi na LEGAL_ENTITY na nivou prikaza — kompozicija, ne novi M6 API.
export default async function NewSubagentPage(props: { searchParams: Promise<{ email?: string; taxId?: string }> }) {
  const searchParams = await props.searchParams;
  const hasQuery = Boolean(searchParams?.email || searchParams?.taxId);
  let matches: ClientAccountSummary[] = [];
  let error: string | null = null;

  if (hasQuery) {
    try {
      const params = new URLSearchParams();
      if (searchParams.email) params.set('email', searchParams.email);
      if (searchParams.taxId) params.set('taxId', searchParams.taxId);
      const all = await apiFetch<ClientAccountSummary[]>(`/crm/client-accounts?${params.toString()}`);
      matches = all.filter((a) => a.accountType === 'LEGAL_ENTITY');
    } catch {
      error = 'Pretraga nalogodavaca nije uspela (M6/client-account/VIEW).';
    }
  }

  return (
    <div className="p-6">
      <RegisterTab label="Novi subagent" />
      <h1 className="mb-4 text-lg font-semibold text-ink">Novi subagent</h1>

      <form className="mb-4 flex gap-2 rounded-lg border border-border bg-panel p-3 text-xs" action="/b2b/novi">
        <input name="email" defaultValue={searchParams?.email ?? ''} placeholder="pretraga nalogodavca (pravno lice) po email-u" className="input flex-1" />
        <input name="taxId" defaultValue={searchParams?.taxId ?? ''} placeholder="ili po PIB-u" className="input flex-1" />
        <button
          type="submit"
          title="Traži"
          className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded bg-brand text-brand-ink hover:brightness-90"
        >
          <Icon name="play" />
        </button>
      </form>

      {error && <p className="mb-4 rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {hasQuery && !error && (
        <div className="mb-4 overflow-hidden rounded-lg border border-border">
          {matches.length === 0 && (
            <p className="p-4 text-xs text-ink-faint">
              Nema pravnih lica koja odgovaraju pretrazi. Nalogodavac mora prvo postojati u <Link href="/crm/novi" className="text-accent hover:underline">CRM-u</Link> kao pravno lice pre registracije kao subagent.
            </p>
          )}
          {matches.map((a) => (
            <NewSubagentForm key={a.id} account={a} />
          ))}
        </div>
      )}
    </div>
  );
}
