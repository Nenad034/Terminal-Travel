import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import EditClientAccountForm from './EditClientAccountForm';
import LoyaltyOverrideForm from './LoyaltyOverrideForm';
import CommunicationLogPanel from '../CommunicationLogPanel';

interface ClientAccount {
  id: string;
  accountType: 'INDIVIDUAL' | 'LEGAL_ENTITY';
  fullName: string | null;
  companyName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  preferredLanguage: string | null;
  marketingConsent: boolean;
  marketingConsentDate: string | null;
  tags: string[] | null;
}

interface GuestProfile {
  id: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
}

interface LoyaltyStatus {
  clientAccountId: string;
  currentTierId: string | null;
  manualOverrideTierId: string | null;
  effectiveTierId: string | null;
  discountPercentage: number;
  calculatedMetricValue: number;
  manualOverrideReason?: string | null;
  manualOverrideBy?: string | null;
  currentTier?: { name: string } | null;
  manualOverrideTier?: { name: string } | null;
}

interface LoyaltyTier {
  id: string;
  name: string;
  rank: number;
  discountPercentage: number;
}

interface TravelHistoryBooking {
  id: string;
  bookingNumber: string;
  status: string;
  createdAt: string;
  items: { id: string; product?: { id: string } | null }[];
}

interface CommunicationLog {
  id: string;
  channel: string;
  direction: string;
  summary: string;
  draftedByAi: boolean;
  sentBy: string | null;
  createdAt: string;
}

// M6 spec §2.1, §3, §4, §5 — profil nalogodavca sa lojalnošću, istorijom putovanja (uživo
// iz M5), povezanim gostima i komunikacijom. M17 spec §2 — kompozicija na nivou prikaza,
// nijedan poziv ne piše direktno u tuđu bazu.
export default async function ClientAccountDetailPage({ params }: { params: { id: string } }) {
  const me = await getMe();
  const canEdit = hasPermission(me, 'M6', 'client-account', 'EDIT');
  const canViewGuests = hasPermission(me, 'M6', 'guest-profile', 'VIEW');
  const canViewLoyalty = hasPermission(me, 'M6', 'loyalty-tier', 'VIEW');
  const canOverride = hasPermission(me, 'M6', 'loyalty-status', 'OVERRIDE');
  const canViewLog = hasPermission(me, 'M6', 'communication-log', 'VIEW');
  const canCreateLog = hasPermission(me, 'M6', 'communication-log', 'CREATE');

  let account: ClientAccount | null = null;
  let error: string | null = null;
  try {
    account = await apiFetch<ClientAccount>(`/crm/client-accounts/${params.id}`);
  } catch (err) {
    error = err instanceof ApiError && err.status === 404 ? 'Nalogodavac nije pronađen.' : 'Nalogodavac trenutno nije dostupan.';
  }

  const [guests, loyalty, tiers, history, log] = await Promise.all([
    account && canViewGuests ? apiFetch<GuestProfile[]>(`/crm/guest-profiles?linkedClientAccountId=${account.id}`).catch(() => []) : Promise.resolve([]),
    account && canViewLoyalty ? apiFetch<LoyaltyStatus>(`/crm/loyalty-status/${account.id}`).catch(() => null) : Promise.resolve(null),
    account && canOverride ? apiFetch<LoyaltyTier[]>('/crm/loyalty-tiers').catch(() => []) : Promise.resolve([]),
    account ? apiFetch<TravelHistoryBooking[]>(`/crm/client-accounts/${account.id}/travel-history`).catch(() => []) : Promise.resolve([]),
    account && canViewLog ? apiFetch<CommunicationLog[]>(`/crm/communication-log?clientAccountId=${account.id}`).catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <RegisterTab label={account ? (account.accountType === 'LEGAL_ENTITY' ? account.companyName ?? '' : account.fullName ?? '') : params.id.slice(0, 8)} />
      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {account && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-mono text-lg">
              <span className="text-accent">$</span> {account.accountType === 'LEGAL_ENTITY' ? account.companyName : account.fullName}
            </h1>
            <span className="rounded bg-panel2 px-2 py-0.5 text-[11px] font-medium text-ink-faint">
              {account.accountType === 'LEGAL_ENTITY' ? 'PRAVNO LICE' : 'FIZIČKO LICE'}
            </span>
          </div>

          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-panel p-4 text-xs text-ink-dim">
              <p>Email: {account.email ?? '—'}</p>
              <p className="mt-1">Telefon: {account.phone ?? '—'}</p>
              <p className="mt-1">Adresa: {account.address ?? '—'}{account.country ? `, ${account.country}` : ''}</p>
              {account.taxId && <p className="mt-1">PIB: {account.taxId}</p>}
              <p className="mt-1">Jezik komunikacije: {account.preferredLanguage ?? '—'}</p>
              <p className="mt-1">
                Marketinška saglasnost:{' '}
                <span className={account.marketingConsent ? 'text-ok' : 'text-danger'}>{account.marketingConsent ? 'da' : 'ne'}</span>
                {account.marketingConsentDate ? ` (${new Date(account.marketingConsentDate).toLocaleDateString('sr-RS')})` : ''}
              </p>
              {account.tags && account.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {account.tags.map((t) => (
                    <span key={t} className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-ink-faint">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {canViewLoyalty && loyalty && (
              <div className="rounded-lg border border-border bg-panel p-4 text-xs text-ink-dim">
                <div className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
                  <Icon name="star-full" className="text-accent" /> Program lojalnosti
                </div>
                <p>
                  Nivo:{' '}
                  <strong className="text-ink">
                    {loyalty.manualOverrideTier?.name ?? loyalty.currentTier?.name ?? 'bez nivoa'}
                  </strong>
                  {loyalty.manualOverrideTierId && <span className="ml-1 text-[10px] text-warn">(ručno dodeljeno)</span>}
                </p>
                <p className="mt-1">Popust: {loyalty.discountPercentage}%</p>
                <p className="mt-1">Izračunata metrika: {loyalty.calculatedMetricValue}</p>
                {loyalty.manualOverrideReason && <p className="mt-1">Razlog override-a: {loyalty.manualOverrideReason}</p>}
                {canOverride && tiers.length > 0 && <LoyaltyOverrideForm clientAccountId={account.id} tiers={tiers} />}
              </div>
            )}
          </div>

          {canEdit && (
            <details className="mb-4 rounded-lg border border-border bg-panel p-4 text-xs">
              <summary className="cursor-pointer font-medium text-ink">Izmeni podatke</summary>
              <div className="mt-3">
                <EditClientAccountForm account={account} />
              </div>
            </details>
          )}

          {canViewGuests && (
            <div className="mb-4 rounded-lg border border-border bg-panel p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Icon name="organization" className="text-accent" /> Povezani gosti
                </div>
                <Link href={`/crm/gosti/novi?linkedClientAccountId=${account.id}`} className="text-xs text-accent hover:underline">
                  + novi gost
                </Link>
              </div>
              {guests.length === 0 ? (
                <p className="text-xs text-ink-faint">Nema povezanih profila gostiju.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {guests.map((g) => (
                    <Link key={g.id} href={`/crm/gosti/${g.id}`} className="flex justify-between rounded px-2 py-1.5 text-xs text-ink hover:bg-panel2">
                      <span>{g.fullName}</span>
                      <span className="text-ink-faint">
                        {g.documentType} {g.documentNumber}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mb-4 rounded-lg border border-border bg-panel p-4">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Icon name="history" className="text-accent" /> Istorija putovanja (uživo iz M5)
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-ink-faint">Nema prethodnih rezervacija.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {history.map((b) => (
                  <Link key={b.id} href={`/rezervacije/${b.id}`} className="flex items-center justify-between rounded px-2 py-1.5 text-xs text-ink hover:bg-panel2">
                    <span>{b.bookingNumber}</span>
                    <span className="text-ink-faint">
                      {b.items.length} stavki · {new Date(b.createdAt).toLocaleDateString('sr-RS')}
                    </span>
                    <StatusBadge status={b.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {canViewLog && (
            <CommunicationLogPanel target={{ clientAccountId: account.id }} entries={log} canCreate={canCreateLog} />
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = ['CONFIRMED', 'COMPLETED'].includes(status) ? 'text-ok bg-ok-bg' : status === 'CANCELLED' ? 'text-danger bg-danger-bg' : 'text-ink-faint bg-panel2';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{status}</span>;
}
