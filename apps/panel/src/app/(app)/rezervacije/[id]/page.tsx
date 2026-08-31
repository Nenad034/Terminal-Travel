import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import PrepareFiscalDocumentButton from '../../finansije/PrepareFiscalDocumentButton';
import BookingHistoryButton from './BookingHistoryButton';
import BookingOwnershipCard from './BookingOwnershipCard';


interface BookingItem {
  id: string;
  productId: string;
  supplierReference?: string;
  finalPrice: number;
  itemStatus: string;
}

interface Booking {
  id: string;
  bookingNumber: string;
  status: string;
  paymentStatus: string;
  voucherUrl: string | null;
  totalPrice?: number;
  currency?: string;
  clientAccountId?: string | null;
  items: BookingItem[];
  // M5 spec §6.5/§6.6 dopuna (31.8.2026) — vlasništvo/zaduženje/franšizna granica.
  ownerId?: string | null;
  assignedToId?: string | null;
}

interface DirectoryUser {
  id: string;
  fullName: string;
}

interface HandoffRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  createdAt: string;
}

interface TravelGuaranteeRegistration {
  id: string;
  status: string;
  cisRegistrationNumber: string | null;
}

interface ClientContract {
  id: string;
  contractType: string;
  status: string;
  documentUrl: string | null;
}

interface ClientAccountSummary {
  id: string;
  accountType: 'INDIVIDUAL' | 'LEGAL_ENTITY';
  fullName: string | null;
  companyName: string | null;
}

// M17 spec §4 (Faza 1), M5 §6 GET /bookings/:id — poziv iz internog panela vraća
// pun (nemaskiran) prikaz, uključujući supplier_reference (M5 spec §6.2).
// M17 spec §2 — ova stranica je direktan primer "kompozicije na nivou prikaza": pored M5
// (status, stavke) dodaje M10 (status fiskalnog dokumenta i plaćanja) i M11 (status garancije
// putovanja) na istom ekranu, poziva samo njihove postojeće API-je, ne uvodi novu logiku.
export default async function BookingDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const me = await getMe();
  const canPrepareFiscal = hasPermission(me, 'M10', 'fiscal-document', 'CREATE_DRAFT');
  const canViewRegistrations = hasPermission(me, 'M11', 'travel-guarantee-registration', 'VIEW');
  const canViewContracts = hasPermission(me, 'M20', 'client-contract', 'VIEW');
  const canViewClientAccount = hasPermission(me, 'M6', 'client-account', 'VIEW');
  // M5 spec §6.5 dopuna (31.8.2026).
  const canTransferOwnership = hasPermission(me, 'M5', 'booking', 'TRANSFER_OWNERSHIP');
  const canProposeHandoff = hasPermission(me, 'M5', 'booking', 'TRANSFER_ASSIGNMENT');
  const canAcceptAssignment = hasPermission(me, 'M5', 'booking', 'ACCEPT_ASSIGNMENT');
  const isVlasnikOrDirektor = Boolean(me?.roles?.some((r) => r === 'VLASNIK' || r === 'DIREKTOR'));

  let booking: Booking | null = null;
  let error: string | null = null;
  try {
    booking = await apiFetch<Booking>(`/sales/bookings/${params.id}`);
  } catch (err) {
    error = err instanceof ApiError && err.status === 404 ? 'Rezervacija nije pronađena.' : 'Rezervacija trenutno nije dostupna.';
  }

  const [registrations, contracts, clientAccount, directory, handoffRequests] = await Promise.all([
    booking && canViewRegistrations
      ? apiFetch<TravelGuaranteeRegistration[]>(`/compliance/travel-guarantee-registrations?bookingId=${booking.id}`).catch(() => [])
      : Promise.resolve([]),
    booking && canViewContracts ? apiFetch<ClientContract[]>(`/client-contracts?bookingId=${booking.id}`).catch(() => []) : Promise.resolve([]),
    booking?.clientAccountId && canViewClientAccount
      ? apiFetch<ClientAccountSummary>(`/crm/client-accounts/${booking.clientAccountId}`).catch(() => null)
      : Promise.resolve(null),
    // M1 spec §6 dopuna (31.8.2026, GET /iam/users/directory) — lagan spisak kolega, bez
    // M1/user/VIEW; koristi se i za prikaz imena vlasnika/zaduženog (svi gledaoci), ne samo
    // za formu prenosa/predaje.
    booking ? apiFetch<DirectoryUser[]>('/iam/users/directory').catch(() => [] as DirectoryUser[]) : Promise.resolve([] as DirectoryUser[]),
    booking ? apiFetch<HandoffRequest[]>(`/sales/bookings/${booking.id}/handoff-requests`).catch(() => []) : Promise.resolve([] as HandoffRequest[]),
  ]);

  const pendingHandoff = handoffRequests.find((h) => h.status === 'PENDING') ?? null;
  const directoryById = new Map(directory.map((u) => [u.id, u.fullName]));

  return (
    <div className="p-6">
      <RegisterTab label={booking?.bookingNumber ?? params.id.slice(0, 8)} />
      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {booking && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-mono text-lg">
              <span className="text-accent">$</span> {booking.bookingNumber}
            </h1>
            <div className="flex items-center gap-2">
              <BookingHistoryButton bookingId={booking.id} />
              <Badge label={booking.status} />
              <Badge label={booking.paymentStatus} />
            </div>
          </div>

          {booking.voucherUrl ? (
            <a href={booking.voucherUrl} target="_blank" rel="noreferrer" className="mb-4 inline-block rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong">
              preuzmi vaučer
            </a>
          ) : (
            <p className="mb-4 text-xs text-ink-faint">Vaučer još nije izdat.</p>
          )}

          {me && (
            <div className="mb-4">
              <BookingOwnershipCard
                bookingId={booking.id}
                ownerId={booking.ownerId ?? null}
                assignedToId={booking.assignedToId ?? null}
                ownerName={booking.ownerId ? (directoryById.get(booking.ownerId) ?? null) : null}
                assignedName={booking.assignedToId ? (directoryById.get(booking.assignedToId) ?? null) : null}
                currentUserId={me.userId}
                isVlasnikOrDirektor={isVlasnikOrDirektor}
                canTransferOwnership={canTransferOwnership}
                canProposeHandoff={canProposeHandoff}
                canAcceptAssignment={canAcceptAssignment}
                directory={directory}
                pendingHandoff={pendingHandoff}
              />
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-border">
            {booking.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0">
                <div>
                  <div className="text-ink">proizvod {item.productId.slice(0, 8)}…</div>
                  {item.supplierReference && <div className="text-xs text-ink-faint">ref. dobavljača: {item.supplierReference}</div>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-ink">{(item.finalPrice / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })}</span>
                  <Badge label={item.itemStatus} />
                </div>
              </div>
            ))}
          </div>

          {(canPrepareFiscal || canViewRegistrations || canViewContracts || canViewClientAccount) && (
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {canViewClientAccount && (
                <CompositionCard icon="organization" title="M6 — nalogodavac">
                  {clientAccount ? (
                    <div className="text-xs text-ink-dim">
                      <p>{clientAccount.accountType === 'LEGAL_ENTITY' ? clientAccount.companyName : clientAccount.fullName}</p>
                      <Link href={`/crm/${clientAccount.id}`} className="mt-2 inline-block text-accent hover:underline">
                        otvori profil →
                      </Link>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-faint">Nalogodavac nije povezan ili nije dostupan.</p>
                  )}
                </CompositionCard>
              )}

              {canPrepareFiscal && (
                <CompositionCard icon="credit-card" title="M10 — fiskalni dokument">
                  <p className="mb-2 text-xs text-ink-faint">Nacrt se priprema automatski pri potvrdi rezervacije; kliknite da ga prikažete i, po potrebi, pošaljete.</p>
                  <PrepareFiscalDocumentButton bookingId={booking.id} />
                </CompositionCard>
              )}

              {canViewRegistrations && (
                <CompositionCard icon="law" title="M11 — garancija putovanja">
                  {registrations.length === 0 ? (
                    <p className="text-xs text-ink-faint">Nema CIS registracije (rezervacija nije ORGANIZATOR tip, ili je posrednička).</p>
                  ) : (
                    registrations.map((r) => (
                      <div key={r.id} className="text-xs text-ink-dim">
                        <Badge label={r.status} />
                        {r.cisRegistrationNumber && <p className="mt-1">CIS broj: {r.cisRegistrationNumber}</p>}
                        <Link href="/compliance" className="mt-2 inline-block text-accent hover:underline">
                          otvori compliance →
                        </Link>
                      </div>
                    ))
                  )}
                </CompositionCard>
              )}

              {canViewContracts && (
                <CompositionCard icon="checklist" title="M20 — ugovor sa klijentom">
                  {contracts.length === 0 ? (
                    <p className="text-xs text-ink-faint">Ugovor još nije generisan.</p>
                  ) : (
                    contracts
                      .filter((c) => c.status !== 'VOIDED')
                      .map((c) => (
                        <div key={c.id} className="text-xs text-ink-dim">
                          <Badge label={c.status} />
                          <p className="mt-1">{c.contractType}</p>
                          <Link href={`/ugovori-klijenti/${c.id}`} className="mt-2 inline-block text-accent hover:underline">
                            otvori ugovor →
                          </Link>
                        </div>
                      ))
                  )}
                </CompositionCard>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CompositionCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon name={icon} className="text-accent" /> {title}
      </div>
      {children}
    </div>
  );
}

function Badge({ label }: { label: string }) {
  const tone = ['CONFIRMED', 'PAID'].includes(label) ? 'text-ok bg-ok-bg' : ['CANCELLED', 'UNPAID'].includes(label) ? 'text-danger bg-danger-bg' : 'text-ink-faint bg-panel2';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}
