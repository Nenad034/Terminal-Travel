import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import PrepareFiscalDocumentButton from '../../finansije/PrepareFiscalDocumentButton';
import BookingHistoryButton from './BookingHistoryButton';
import BookingOwnershipCard from './BookingOwnershipCard';
import BookingNotesCard, { BookingNote } from './BookingNotesCard';
import ActorLabel from '@/components/ActorLabel';


interface BookingItemProduct {
  id: string;
  type: string;
  name: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
}

interface BookingItemGuest {
  id: string;
  guestFirstName: string;
  guestLastName: string;
  guestProfileId: string | null;
}

interface BookingItem {
  id: string;
  productId: string;
  supplierReference?: string;
  finalPrice: number;
  finalPriceCurrency?: string;
  itemStatus: string;
  // M5 spec §4.5 dopuna (1.9.2026) — šta je stvarno kupljeno i ko putuje.
  stayFrom?: string;
  stayTo?: string;
  unitCount?: number;
  product?: BookingItemProduct | null;
  guests?: BookingItemGuest[];
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

// M5 spec §4.5 (1.9.2026) — kartice Finansije/Komunikacija/Dokumenti su ISKLJUČIVO prikaz nad
// tuđim API-jima (M10 Payment, M6 CommunicationLog, M20 ClientContract), bez ijednog novog polja
// u M5. Samo kartica Beleške čita nov M5 entitet (`BookingNote`, §4.6).
interface Payment {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  reference?: string | null;
  receivedAt?: string | null;
  createdAt: string;
}

interface CommunicationEntry {
  id: string;
  channel: string;
  direction: string;
  category: string;
  summary: string;
  draftedByAi: boolean;
  sentBy?: string | null;
  createdAt: string;
}

interface GuestProfileSummary {
  id: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  nationality: string;
  dateOfBirth: string;
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
const TABS = [
  { id: 'pregled', label: 'Pregled', icon: 'list-flat' },
  { id: 'aranzman', label: 'Aranžman', icon: 'package' },
  { id: 'putnici', label: 'Putnici', icon: 'organization' },
  { id: 'finansije', label: 'Finansije', icon: 'credit-card' },
  { id: 'komunikacija', label: 'Komunikacija', icon: 'comment' },
  { id: 'dokumenti', label: 'Dokumenti', icon: 'file' },
  { id: 'beleske', label: 'Beleške', icon: 'note' },
] as const;

export default async function BookingDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await props.params;
  const search = await props.searchParams;
  const activeTab = TABS.some((t) => t.id === search.tab) ? (search.tab as string) : 'pregled';
  const me = await getMe();
  const canPrepareFiscal = hasPermission(me, 'M10', 'fiscal-document', 'CREATE_DRAFT');
  const canViewRegistrations = hasPermission(me, 'M11', 'travel-guarantee-registration', 'VIEW');
  const canViewContracts = hasPermission(me, 'M20', 'client-contract', 'VIEW');
  const canViewClientAccount = hasPermission(me, 'M6', 'client-account', 'VIEW');
  // M5 spec §6.5 dopuna (31.8.2026).
  // M5 spec §4.5 — kartica se prikazuje samo uz dozvolu matičnog modula; odsustvo dozvole
  // znači da kartice nema, ne da je prazna.
  const canViewPayments = hasPermission(me, 'M10', 'payment', 'VIEW');
  const canViewCommunication = hasPermission(me, 'M6', 'communication-log', 'VIEW');
  // §4.5 — dokument/državljanstvo/datum rođenja su M6 podatak, ne M5.
  const canViewGuestProfiles = hasPermission(me, 'M6', 'guest-profile', 'VIEW');
  // M5 spec §4.6 — beleške se VIDE sa rezervacijom (nema zasebne VIEW dozvole).
  const canCreateNote = hasPermission(me, 'M5', 'booking-note', 'CREATE');
  const canDeleteNote = hasPermission(me, 'M5', 'booking-note', 'DELETE');
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

  // Podaci kartica se dohvataju samo za otvorenu karticu — ekran rezervacije se otvara desetinama
  // puta dnevno, nema razloga zvati M10/M6 kad se gleda Pregled.
  const [payments, communications, notes] = await Promise.all([
    booking && canViewPayments && activeTab === 'finansije'
      ? apiFetch<Payment[]>(`/finance/payments?bookingId=${booking.id}`).catch(() => [] as Payment[])
      : Promise.resolve([] as Payment[]),
    // M5 spec §4.5 poznato ograničenje: `CommunicationLog` nema `booking_id`, pa je ovo prepiska
    // sa NALOGODAVCEM te rezervacije, ne prepiska o toj rezervaciji — tako je i označeno u prikazu.
    booking?.clientAccountId && canViewCommunication && activeTab === 'komunikacija'
      ? apiFetch<CommunicationEntry[]>(`/crm/communication-log?clientAccountId=${booking.clientAccountId}`).catch(() => [] as CommunicationEntry[])
      : Promise.resolve([] as CommunicationEntry[]),
    booking && activeTab === 'beleske'
      ? apiFetch<BookingNote[]>(`/sales/bookings/${booking.id}/notes`).catch(() => [] as BookingNote[])
      : Promise.resolve([] as BookingNote[]),
  ]);

  // Profili gostiju (M6) — samo za karticu Putnici i samo uz dozvolu; jedan poziv po
  // JEDINSTVENOM profilu, ne po putniku (isti gost može biti na više stavki rezervacije).
  const guestProfileIds =
    booking && activeTab === 'putnici' && canViewGuestProfiles
      ? [...new Set(booking.items.flatMap((i) => (i.guests ?? []).map((g) => g.guestProfileId).filter((id): id is string => Boolean(id))))]
      : [];
  const guestProfiles = (
    await Promise.all(guestProfileIds.map((id) => apiFetch<GuestProfileSummary>(`/crm/guest-profiles/${id}`).catch(() => null)))
  ).filter((p): p is GuestProfileSummary => p !== null);
  const guestProfilesById = new Map(guestProfiles.map((p) => [p.id, p]));

  // Samo evidentirane (ne otkazane/neuspele) uplate ulaze u zbir — status dolazi iz M10.
  // M10 `PaymentRecordStatus`: PENDING/RECEIVED/FAILED/REFUNDED/VOIDED — samo RECEIVED je novac
  // koji je stvarno stigao; REFUNDED je vraćen, ostalo nikad nije ni ušlo.
  const paidTotal = payments.filter((p) => p.status === 'RECEIVED').reduce((sum, p) => sum + p.amount, 0);
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

          {/* M5 spec §4.5 — kartice dosijea. Stanje se drži u URL-u (`?tab=`), ne u klijentskom
              state-u, da se pojedinačna kartica može podeliti linkom i da stranica ostane
              server-komponenta (bez povlačenja podataka koje ta kartica ne traži). */}
          <nav className="mb-4 flex flex-wrap gap-1 border-b border-border">
            {TABS.map((t) => (
              <Link
                key={t.id}
                href={`/rezervacije/${params.id}?tab=${t.id}`}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium ${
                  activeTab === t.id ? 'border-accent text-accent' : 'border-transparent text-ink-faint hover:text-ink'
                }`}
              >
                <Icon name={t.icon} /> {t.label}
              </Link>
            ))}
          </nav>

          {activeTab === 'pregled' && me && (
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

          {activeTab === 'pregled' && (
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
          )}

          {activeTab === 'pregled' && (canPrepareFiscal || canViewRegistrations || canViewContracts || canViewClientAccount) && (
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

          {/* M5 spec §4.5 — Aranžman: šta je stvarno kupljeno. Do 1.9.2026 je ovaj ekran
              prikazivao samo skraćen `productId` (sirov UUID), bez naziva, datuma i broja jedinica. */}
          {activeTab === 'aranzman' && (
            <div className="space-y-3">
              {booking.items.length === 0 ? (
                <p className="text-xs text-ink-faint">Rezervacija nema nijednu stavku.</p>
              ) : (
                booking.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border bg-panel p-4">
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-ink">
                          {item.product?.name ?? <span className="text-ink-faint">naziv proizvoda nije dostupan</span>}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-faint">
                          {[item.product?.type, [item.product?.destinationCity, item.product?.destinationCountry].filter(Boolean).join(', ')]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-semibold text-ink">{formatMoney(item.finalPrice, item.finalPriceCurrency ?? booking.currency)}</span>
                        <Badge label={item.itemStatus} />
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
                      <Field label="Od" value={item.stayFrom ? new Date(item.stayFrom).toLocaleDateString('sr-RS') : '—'} />
                      <Field label="Do" value={item.stayTo ? new Date(item.stayTo).toLocaleDateString('sr-RS') : '—'} />
                      <Field label="Noćenja" value={nightsBetween(item.stayFrom, item.stayTo)} />
                      <Field label="Jedinica" value={String(item.unitCount ?? 1)} />
                      <Field label="Putnika na stavci" value={String(item.guests?.length ?? 0)} />
                      {item.supplierReference && <Field label="Ref. dobavljača" value={item.supplierReference} />}
                    </dl>
                  </div>
                ))
              )}
            </div>
          )}

          {/* M5 spec §4.5/§4.3 — Putnici: `BookingItemGuest` po stavci. Ime/prezime dolaze iz M5;
              dokument/državljanstvo/datum rođenja su M6 podatak i dohvataju se samo uz
              `M6/guest-profile/VIEW` (isti obrazac kao ostale kartice — bez dozvole se ne prikazuju). */}
          {activeTab === 'putnici' && (
            <div className="space-y-3">
              {booking.items.every((i) => (i.guests?.length ?? 0) === 0) ? (
                <p className="text-xs text-ink-faint">Na rezervaciji nema unetih putnika.</p>
              ) : (
                booking.items
                  .filter((i) => (i.guests?.length ?? 0) > 0)
                  .map((item) => (
                    <div key={item.id} className="rounded-lg border border-border bg-panel p-4">
                      <div className="mb-2 text-xs font-semibold text-ink">
                        {item.product?.name ?? 'stavka'}{' '}
                        <span className="font-normal text-ink-faint">
                          · {item.stayFrom ? new Date(item.stayFrom).toLocaleDateString('sr-RS') : '—'}
                          {' – '}
                          {item.stayTo ? new Date(item.stayTo).toLocaleDateString('sr-RS') : '—'}
                        </span>
                      </div>
                      <ul className="divide-y divide-border">
                        {(item.guests ?? []).map((g) => {
                          const profile = g.guestProfileId ? guestProfilesById.get(g.guestProfileId) : null;
                          return (
                            <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                              <span className="text-ink">
                                {g.guestFirstName} {g.guestLastName}
                              </span>
                              {profile ? (
                                <span className="flex flex-wrap items-center gap-3 text-xs text-ink-faint">
                                  <span>
                                    {profile.documentType} {profile.documentNumber}
                                  </span>
                                  <span>{profile.nationality}</span>
                                  <span>{new Date(profile.dateOfBirth).toLocaleDateString('sr-RS')}</span>
                                  <Link href={`/crm/gosti/${profile.id}`} className="text-accent hover:underline">
                                    profil →
                                  </Link>
                                </span>
                              ) : (
                                <span className="text-xs text-ink-faint">
                                  {g.guestProfileId
                                    ? canViewGuestProfiles
                                      ? 'profil gosta nije dostupan'
                                      : 'podaci dokumenta zahtevaju M6/guest-profile/VIEW'
                                    : 'nema povezan profil gosta (samo ime i prezime)'}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* M5 spec §4.5 — Finansije: prikaz nad M10 `Payment`, bez ijednog novog polja u M5. */}
          {activeTab === 'finansije' &&
            (!canViewPayments ? (
              <p className="text-xs text-ink-faint">
                Nemate dozvolu za uvid u uplate (<code>M10/payment/VIEW</code>).
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard label="Ukupna cena" value={formatMoney(booking.totalPrice ?? 0, booking.currency)} />
                  <StatCard label="Uplaćeno" value={formatMoney(paidTotal, booking.currency)} />
                  <StatCard
                    label="Preostalo"
                    value={formatMoney((booking.totalPrice ?? 0) - paidTotal, booking.currency)}
                    tone={(booking.totalPrice ?? 0) - paidTotal > 0 ? 'danger' : 'ok'}
                  />
                </div>
                {payments.length === 0 ? (
                  <p className="text-xs text-ink-faint">Nema evidentiranih uplata za ovu rezervaciju.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-border">
                    {payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0">
                        <div>
                          <div className="text-ink">{p.method}</div>
                          <div className="text-xs text-ink-faint">
                            {new Date(p.receivedAt ?? p.createdAt).toLocaleDateString('sr-RS')}
                            {p.reference ? ` · ${p.reference}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-semibold text-ink">{formatMoney(p.amount, p.currency)}</span>
                          <Badge label={p.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-ink-faint">
                  Uplate se unose i knjiže u M10 (Finansije) — ovaj prikaz ih samo čita, M5 ne drži sopstvenu evidenciju plaćanja (M5 spec §5).
                </p>
              </div>
            ))}

          {/* M5 spec §4.5 — Komunikacija: prikaz nad M6 `CommunicationLog`. */}
          {activeTab === 'komunikacija' &&
            (!canViewCommunication ? (
              <p className="text-xs text-ink-faint">
                Nemate dozvolu za uvid u komunikaciju (<code>M6/communication-log/VIEW</code>).
              </p>
            ) : !booking.clientAccountId ? (
              <p className="text-xs text-ink-faint">Rezervacija nema povezan nalog nalogodavca, pa nema ni prepiske za prikaz.</p>
            ) : (
              <div className="space-y-3">
                <p className="rounded border border-warn/30 bg-warn-bg px-3 py-2 text-[11px] text-warn">
                  Ovo je celokupna prepiska sa <strong>nalogodavcem</strong> ove rezervacije, ne samo o ovoj rezervaciji — M6 zapis komunikacije danas nema vezu ka pojedinačnoj rezervaciji (M5 spec §4.5).
                </p>
                {communications.length === 0 ? (
                  <p className="text-xs text-ink-faint">Nema zabeležene komunikacije sa ovim nalogodavcem.</p>
                ) : (
                  <ul className="space-y-2">
                    {communications.map((c) => (
                      <li key={c.id} className="rounded-lg border border-border bg-panel p-3">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                          <Badge label={c.channel} />
                          <Badge label={c.direction} />
                          <Badge label={c.category} />
                          <ActorLabel
                            name={c.sentBy ? (directoryById.get(c.sentBy) ?? (c.sentBy === 'SYSTEM_AUTO' ? 'automatski' : null)) : null}
                            origin={c.sentBy === 'SYSTEM_AUTO' ? 'SYSTEM' : 'STAFF'}
                            draftedByAi={c.draftedByAi}
                          />
                          <span>· {new Date(c.createdAt).toLocaleString('sr-RS')}</span>
                        </div>
                        <p className="text-sm text-ink">{c.summary}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

          {/* M5 spec §4.5 — Dokumenti: vaučer (M5), ugovor sa klijentom (M20), fiskalni dokument (M10). */}
          {activeTab === 'dokumenti' && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <CompositionCard icon="file" title="M5 — vaučer">
                {booking.voucherUrl ? (
                  <a
                    href={booking.voucherUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong"
                  >
                    preuzmi vaučer
                  </a>
                ) : (
                  <p className="text-xs text-ink-faint">Vaučer još nije izdat.</p>
                )}
              </CompositionCard>

              {canViewContracts && (
                <CompositionCard icon="checklist" title="M20 — ugovor sa klijentom">
                  {contracts.filter((c) => c.status !== 'VOIDED').length === 0 ? (
                    <p className="text-xs text-ink-faint">Ugovor još nije generisan.</p>
                  ) : (
                    contracts
                      .filter((c) => c.status !== 'VOIDED')
                      .map((c) => (
                        <div key={c.id} className="mb-2 text-xs text-ink-dim last:mb-0">
                          <Badge label={c.status} />
                          <p className="mt-1">{c.contractType}</p>
                          <div className="mt-2 flex gap-3">
                            {c.documentUrl && (
                              <a href={c.documentUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                                preuzmi →
                              </a>
                            )}
                            <Link href={`/ugovori-klijenti/${c.id}`} className="text-accent hover:underline">
                              otvori ugovor →
                            </Link>
                          </div>
                        </div>
                      ))
                  )}
                </CompositionCard>
              )}

              {canPrepareFiscal && (
                <CompositionCard icon="credit-card" title="M10 — fiskalni dokument">
                  <p className="mb-2 text-xs text-ink-faint">
                    Nacrt se priprema automatski pri potvrdi rezervacije; kliknite da ga prikažete i, po potrebi, pošaljete.
                  </p>
                  <PrepareFiscalDocumentButton bookingId={booking.id} />
                </CompositionCard>
              )}
            </div>
          )}

          {/* M5 spec §4.6 — Beleške: jedini nov M5 podatak u ovoj dopuni. */}
          {activeTab === 'beleske' && (
            <BookingNotesCard
              bookingId={booking.id}
              notes={notes.map((n) => ({ ...n, authorName: directoryById.get(n.createdBy) ?? null }))}
              currentUserId={me?.userId ?? null}
              canCreate={canCreateNote}
              canDelete={canDeleteNote}
              isVlasnikOrDirektor={isVlasnikOrDirektor}
            />
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function nightsBetween(from?: string, to?: string): string {
  if (!from || !to) return '—';
  const n = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
  return n > 0 ? String(n) : '—';
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'danger' }) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'ok' ? 'text-ok' : 'text-ink';
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className={`mt-1 font-mono text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}

// Novac je svuda u sistemu ceo broj (para/cent), nikad float — ista konvencija kao ostatak panela.
function formatMoney(amountMinor: number, currency?: string): string {
  return `${(amountMinor / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`;
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
