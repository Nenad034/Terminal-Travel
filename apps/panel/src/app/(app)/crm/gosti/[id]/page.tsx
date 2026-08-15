import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import EditGuestProfileForm from './EditGuestProfileForm';
import CommunicationLogPanel from '../../CommunicationLogPanel';

interface GuestProfile {
  id: string;
  fullName: string;
  documentType: 'PASSPORT' | 'LICNA_KARTA';
  documentNumber: string;
  nationality: string;
  dateOfBirth: string;
  email: string | null;
  phone: string | null;
  preferences: Record<string, unknown> | null;
  linkedClientAccountId: string | null;
}

interface ClientAccount {
  id: string;
  accountType: 'INDIVIDUAL' | 'LEGAL_ENTITY';
  fullName: string | null;
  companyName: string | null;
}

interface TravelHistoryItem {
  id: string;
  itemStatus: string;
  stayFrom: string;
  stayTo: string;
  booking?: { id: string; bookingNumber: string } | null;
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

// M6 spec §2.2, §5 — profil gosta, istorija putovanja preko BookingItemGuest (uživo iz M5),
// veza ka nalogodavcu (§2.2 linked_client_account_id) i komunikacija.
export default async function GuestProfileDetailPage({ params }: { params: { id: string } }) {
  const me = await getMe();
  const canEdit = hasPermission(me, 'M6', 'guest-profile', 'EDIT');
  const canViewLinkedAccount = hasPermission(me, 'M6', 'client-account', 'VIEW');
  const canViewLog = hasPermission(me, 'M6', 'communication-log', 'VIEW');
  const canCreateLog = hasPermission(me, 'M6', 'communication-log', 'CREATE');

  let guest: GuestProfile | null = null;
  let error: string | null = null;
  try {
    guest = await apiFetch<GuestProfile>(`/crm/guest-profiles/${params.id}`);
  } catch (err) {
    error = err instanceof ApiError && err.status === 404 ? 'Profil gosta nije pronađen.' : 'Profil gosta trenutno nije dostupan.';
  }

  const [linkedAccount, history, log] = await Promise.all([
    guest?.linkedClientAccountId && canViewLinkedAccount
      ? apiFetch<ClientAccount>(`/crm/client-accounts/${guest.linkedClientAccountId}`).catch(() => null)
      : Promise.resolve(null),
    guest ? apiFetch<TravelHistoryItem[]>(`/crm/guest-profiles/${guest.id}/travel-history`).catch(() => []) : Promise.resolve([]),
    guest && canViewLog ? apiFetch<CommunicationLog[]>(`/crm/communication-log?guestProfileId=${guest.id}`).catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <RegisterTab label={guest ? guest.fullName : params.id.slice(0, 8)} />
      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {guest && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-mono text-lg">
              <span className="text-accent">$</span> {guest.fullName}
            </h1>
            <span className="rounded bg-panel2 px-2 py-0.5 text-[11px] font-medium text-ink-faint">
              {guest.documentType} {guest.documentNumber}
            </span>
          </div>

          <div className="mb-4 rounded-lg border border-border bg-panel p-4 text-xs text-ink-dim">
            <p>Državljanstvo: {guest.nationality}</p>
            <p className="mt-1">Datum rođenja: {new Date(guest.dateOfBirth).toLocaleDateString('sr-RS')}</p>
            <p className="mt-1">Email: {guest.email ?? '—'}</p>
            <p className="mt-1">Telefon: {guest.phone ?? '—'}</p>
            {linkedAccount && (
              <p className="mt-1">
                Nalogodavac:{' '}
                <Link href={`/crm/${linkedAccount.id}`} className="text-accent hover:underline">
                  {linkedAccount.accountType === 'LEGAL_ENTITY' ? linkedAccount.companyName : linkedAccount.fullName}
                </Link>
              </p>
            )}
            {guest.preferences && Object.keys(guest.preferences).length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-ink">preference</summary>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px] text-ink-faint">{JSON.stringify(guest.preferences, null, 2)}</pre>
              </details>
            )}
          </div>

          {canEdit && (
            <details className="mb-4 rounded-lg border border-border bg-panel p-4 text-xs">
              <summary className="cursor-pointer font-medium text-ink">Izmeni podatke</summary>
              <div className="mt-3">
                <EditGuestProfileForm guest={guest} />
              </div>
            </details>
          )}

          <div className="mb-4 rounded-lg border border-border bg-panel p-4">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Icon name="history" className="text-accent" /> Istorija putovanja (uživo iz M5)
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-ink-faint">Nema prethodnih putovanja.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {history.map((item) => (
                  <Link
                    key={item.id}
                    href={item.booking ? `/rezervacije/${item.booking.id}` : '#'}
                    className="flex items-center justify-between rounded px-2 py-1.5 text-xs text-ink hover:bg-panel2"
                  >
                    <span>{item.booking?.bookingNumber ?? item.id.slice(0, 8)}</span>
                    <span className="text-ink-faint">
                      {new Date(item.stayFrom).toLocaleDateString('sr-RS')} – {new Date(item.stayTo).toLocaleDateString('sr-RS')}
                    </span>
                    <StatusBadge status={item.itemStatus} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {canViewLog && <CommunicationLogPanel target={{ guestProfileId: guest.id }} entries={log} canCreate={canCreateLog} />}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = ['CONFIRMED', 'COMPLETED'].includes(status) ? 'text-ok bg-ok-bg' : status === 'CANCELLED' ? 'text-danger bg-danger-bg' : 'text-ink-faint bg-panel2';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{status}</span>;
}
