import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import PrepareFiscalDocumentButton from '../../finansije/PrepareFiscalDocumentButton';
import RecordPaymentForm, { BankOption } from '../../finansije/fiskalni-dokumenti/[id]/RecordPaymentForm';
import PaymentRow from '../../finansije/fiskalni-dokumenti/[id]/PaymentRow';
import BookingHistoryButton from './BookingHistoryButton';
import BookingOwnershipCard from './BookingOwnershipCard';
import BookingNotesCard, { BookingNote } from './BookingNotesCard';
import BookingChangesCard from './BookingChangesCard';
import BookingRepsCard, { RepCheckIn } from './BookingRepsCard';
import ActorLabel from '@/components/ActorLabel';
import AddServicePanel from './AddServicePanel';
import AranzmanItemCard, { CandidateProduct } from './AranzmanItemCard';
import BookingItemGuestsEditor from './BookingItemGuestsEditor';
import CommunicationFilterList from './CommunicationFilterList';
import { PRODUCT_ICONS } from '@/lib/search-product-types';
import { formatCountry, formatBoard, formatRoomType, formatOccupancy } from '@/lib/travel-labels';
import OverviewLayoutSwitch from './OverviewLayoutSwitch';
// Ključ i tip dolaze iz NEUTRALNOG modula, ne iz `OverviewLayoutSwitch.tsx` — vidi obrazloženje
// u `overview-layout.ts`; uvoz konstante iz `'use client'` fajla ovde tiho daje pogrešnu vrednost.
import { OVERVIEW_LAYOUT_PREFERENCE_KEY, DEFAULT_OVERVIEW_LAYOUT, type OverviewLayout } from './overview-layout';
import BookingOverviewHero, { OverviewSection, RelatedRow, ScrollableRows, OVERVIEW_ROW_LIMIT, type HeroFact } from './BookingOverviewHero';


interface BookingItemProduct {
  id: string;
  type: string;
  name: string | null;
  destinationCity: string | null;
  // M2 spec §2.1b (4.9.2026) — regija/poluostrvo KAD se razlikuje od destinationCity
  // (npr. "Sitonija, Halkidiki" za mesto koje je unutar Halkidikija).
  destinationArea?: string | null;
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
  // M5 spec §4.5 dopuna (2.9.2026) — tip smeštajne jedinice i usluga (pansion) iz ugovora
  // (`RateLine`/`ContractPeriod`, M3). `null` za stavke koje dolaze preko M4 spoljnog API-ja —
  // one nemaju red cenovnika, pa se ništa ne prikazuje umesto da se pogađa.
  roomType?: string | null;
  boardType?: string | null;
  occupancy?: string | null;
  product?: BookingItemProduct | null;
  guests?: BookingItemGuest[];
  // M9 spec §4 — predstavnik (vodič) na destinaciji za tu stavku.
  assignedGuideId?: string | null;
  // M5 spec §6.7a (3.9.2026) — doplata/popust je VEZANA stavka: prikazuje se UZ matičnu, ne
  // kao samostalan red. `payable = ON_SITE` znači da iznos ne ulazi u ukupno zaduženje.
  parentItemId?: string | null;
  ancillaryServiceId?: string | null;
  payable?: 'AGENCY' | 'ON_SITE';
  /** Naziv doplate/popusta iz M3 ugovora — doplata nema sopstven proizvod, pa ni njegovo ime. */
  ancillaryService?: { name: string; kind: 'SURCHARGE' | 'DISCOUNT'; priceBasis: string } | null;
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
  // M1 dopuna (2.9.2026) — popunjeno samo kad je poziv sužen preko `?role=` (npr. VODIC za
  // karticu Predstavnici); opšti direktorijum bez role i dalje vraća samo id+fullName.
  phone?: string | null;
  email?: string | null;
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
  bank?: { id: string; name: string } | null;
  checkDetails?: { id: string; bankId: string; amount: number; checkNumber: string; clearanceDate: string }[];
  editable?: boolean;
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

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  category: string;
  priority: string;
  zzpResponseDeadline: string | null;
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
  { id: 'reklamacije', label: 'Reklamacije', icon: 'law' },
  { id: 'predstavnici', label: 'Predstavnici', icon: 'account' },
  { id: 'izmene', label: 'Izmene', icon: 'edit' },
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
  // Dopuna (2.9.2026, na zahtev vlasnika) — unos uplate direktno u kartici Finansije.
  const canRecordPayment = hasPermission(me, 'M10', 'payment', 'RECORD');
  const canViewCommunication = hasPermission(me, 'M6', 'communication-log', 'VIEW');
  // §4.5 — dokument/državljanstvo/datum rođenja su M6 podatak, ne M5.
  const canViewGuestProfiles = hasPermission(me, 'M6', 'guest-profile', 'VIEW');
  // M5 spec §4.6 — beleške se VIDE sa rezervacijom (nema zasebne VIEW dozvole).
  const canCreateNote = hasPermission(me, 'M5', 'booking-note', 'CREATE');
  const canDeleteNote = hasPermission(me, 'M5', 'booking-note', 'DELETE');
  // M5 spec §6/§6.4 — otkazivanje i izmena; do 1.9.2026 su postojale samo na API-ju.
  const canCancelBooking = hasPermission(me, 'M5', 'booking', 'CANCEL');
  const canModifyBooking = hasPermission(me, 'M5', 'booking', 'MODIFY');
  // M5 spec §4.5 — kartice Reklamacije (M14) i Predstavnici (M9).
  const canViewTickets = hasPermission(me, 'M14', 'ticket', 'VIEW');
  const canCreateTicket = hasPermission(me, 'M14', 'ticket', 'CREATE');
  const canViewCheckIns = hasPermission(me, 'M9', 'field-checkin', 'VIEW');
  const canTransferOwnership = hasPermission(me, 'M5', 'booking', 'TRANSFER_OWNERSHIP');
  const canProposeHandoff = hasPermission(me, 'M5', 'booking', 'TRANSFER_ASSIGNMENT');
  const canAcceptAssignment = hasPermission(me, 'M5', 'booking', 'ACCEPT_ASSIGNMENT');
  const isVlasnikOrDirektor = Boolean(me?.roles?.some((r) => r === 'VLASNIK' || r === 'DIREKTOR'));
  // Dopuna (2.9.2026, na zahtev vlasnika) — kartica Aranžman: spisak kandidata za "izmeni
  // uslugu" dolazi iz M2 kataloga, zahteva istu dozvolu kao svaki drugi uvid u katalog.
  const canViewProducts = hasPermission(me, 'M2', 'product', 'VIEW');

  // Izgled kartice "Pregled" (2.9.2026) — nov je podrazumevan, zatečeni ostaje dostupan preko
  // prekidača dok vlasnik ne odluči koji ostaje. Vidi `OverviewLayoutSwitch.tsx` za razlog zašto
  // ovo postoji i zašto je privremeno. Neuspelo čitanje ne sme da obori ekran — pada na nov.
  let overviewLayout: OverviewLayout = DEFAULT_OVERVIEW_LAYOUT;
  try {
    const prefs = await apiFetch<Record<string, unknown>>('/iam/users/me/preferences');
    if (prefs?.[OVERVIEW_LAYOUT_PREFERENCE_KEY] === 'klasicni') overviewLayout = 'klasicni';
  } catch {
    // podešavanja nisu dostupna — ostaje podrazumevani izgled
  }

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
  // puta dnevno, nema razloga zvati M10/M6 kad se gleda neka DRUGA kartica. Dopuna (2.9.2026, na
  // zahtev vlasnika: "u tabu Pregled treba da se vide svi bitni podaci... ovde se ništa ne menja
  // samo se prikazuje") — Pregled sad dohvata ISTO što i svaka pojedinačna kartica (svaka
  // sopstvena VIEW dozvola i dalje važi, isto kao i pre), samo ih prikazuje bez interaktivnih
  // formi (nema kreiranja beleške, dodele vodiča, otvaranja tiketa — samo čitanje).
  const onOverview = activeTab === 'pregled';
  const [payments, communications, notes] = await Promise.all([
    booking && canViewPayments && (activeTab === 'finansije' || onOverview)
      ? apiFetch<Payment[]>(`/finance/payments?bookingId=${booking.id}`).catch(() => [] as Payment[])
      : Promise.resolve([] as Payment[]),
    // M5 spec §4.5 poznato ograničenje: `CommunicationLog` nema `booking_id`, pa je ovo prepiska
    // sa NALOGODAVCEM te rezervacije, ne prepiska o toj rezervaciji — tako je i označeno u prikazu.
    booking?.clientAccountId && canViewCommunication && (activeTab === 'komunikacija' || onOverview)
      ? apiFetch<CommunicationEntry[]>(`/crm/communication-log?clientAccountId=${booking.clientAccountId}`).catch(() => [] as CommunicationEntry[])
      : Promise.resolve([] as CommunicationEntry[]),
    booking && (activeTab === 'beleske' || onOverview)
      ? apiFetch<BookingNote[]>(`/sales/bookings/${booking.id}/notes`).catch(() => [] as BookingNote[])
      : Promise.resolve([] as BookingNote[]),
  ]);

  const [tickets, checkIns, guides] = await Promise.all([
    booking && canViewTickets && (activeTab === 'reklamacije' || onOverview)
      ? apiFetch<Ticket[]>(`/helpdesk/tickets?relatedBookingId=${booking.id}`).catch(() => [] as Ticket[])
      : Promise.resolve([] as Ticket[]),
    booking && canViewCheckIns && (activeTab === 'predstavnici' || onOverview)
      ? apiFetch<RepCheckIn[]>(`/mobile/staff/check-ins?bookingId=${booking.id}`).catch(() => [] as RepCheckIn[])
      : Promise.resolve([] as RepCheckIn[]),
    // Spisak isključivo VODIC naloga — dodela predstavnika ne sme da nudi ceo tim. Pregled ne
    // dodeljuje, ali TREBA mu isti spisak radi kontakt podataka (telefon/email) dodeljenog
    // predstavnika u read-only prikazu (dopuna 2.9.2026).
    booking && (activeTab === 'predstavnici' || onOverview)
      ? apiFetch<DirectoryUser[]>('/iam/users/directory?role=VODIC').catch(() => [] as DirectoryUser[])
      : Promise.resolve([] as DirectoryUser[]),
  ]);

  // M10 spec §5.2 dopuna (2.9.2026) — spisak banaka za formu unosa uplate, samo kad forma
  // stvarno može da se prikaže.
  const banks =
    booking && canRecordPayment && activeTab === 'finansije'
      ? await apiFetch<BankOption[]>('/finance/banks').catch(() => [] as BankOption[])
      : [];

  // Profili gostiju (M6) — samo za karticu Putnici/Pregled i samo uz dozvolu; jedan poziv po
  // JEDINSTVENOM profilu, ne po putniku (isti gost može biti na više stavki rezervacije).
  const guestProfileIds =
    booking && (activeTab === 'putnici' || onOverview) && canViewGuestProfiles
      ? [...new Set(booking.items.flatMap((i) => (i.guests ?? []).map((g) => g.guestProfileId).filter((id): id is string => Boolean(id))))]
      : [];
  const guestProfiles = (
    await Promise.all(guestProfileIds.map((id) => apiFetch<GuestProfileSummary>(`/crm/guest-profiles/${id}`).catch(() => null)))
  ).filter((p): p is GuestProfileSummary => p !== null);
  const guestProfilesById = new Map(guestProfiles.map((p) => [p.id, p]));

  // M5 spec §6 dopuna (2.9.2026) — kartica Aranžman: spisak kandidata "za izmenu usluge" po
  // tipu proizvoda prisutnom na aktivnim stavkama. Samo kad je izmena uopšte moguća (dozvola +
  // aktivna stavka postoji) — ne poziva se M2 katalog kad na Aranžmanu nema šta da se menja.
  // §6.7a — zbir onoga što se plaća na licu mesta. Računa se iz stavki koje su već dovučene
  // (nema drugog poziva): `payable = ON_SITE` je jedini slučaj u M5 gde stavka ima cenu a ne
  // ulazi u `Booking.total_price`.
  const onSiteTotal =
    booking?.items.filter((i) => i.payable === 'ON_SITE' && i.itemStatus !== 'CANCELLED').reduce((sum, i) => sum + i.finalPrice, 0) ?? 0;

  const activeItems = booking?.items.filter((i) => i.itemStatus !== 'CANCELLED') ?? [];
  const modifiableTypes = [...new Set(activeItems.map((i) => i.product?.type).filter((t): t is string => Boolean(t)))];
  const candidatesByType = new Map<string, CandidateProduct[]>();
  if (booking && activeTab === 'aranzman' && canModifyBooking && canViewProducts) {
    await Promise.all(
      modifiableTypes.map(async (type) => {
        const list = await apiFetch<
          { id: string; destinationCity: string; destinationArea: string | null; destinationCountry: string; translation: { name: string } | null }[]
        >(`/catalog/products?type=${type}&status=ACTIVE&lang=sr`).catch(() => []);
        candidatesByType.set(
          type,
          list.map((p) => ({
            id: p.id,
            name: p.translation?.name ?? p.id.slice(0, 8),
            destinationCity: p.destinationCity,
            destinationArea: p.destinationArea,
            destinationCountry: p.destinationCountry,
          })),
        );
      }),
    );
  }

  // Samo evidentirane (ne otkazane/neuspele) uplate ulaze u zbir — status dolazi iz M10.
  // M10 `PaymentRecordStatus`: PENDING/RECEIVED/FAILED/REFUNDED/VOIDED — samo RECEIVED je novac
  // koji je stvarno stigao; REFUNDED je vraćen, ostalo nikad nije ni ušlo.
  const paidTotal = payments.filter((p) => p.status === 'RECEIVED').reduce((sum, p) => sum + p.amount, 0);
  const pendingHandoff = handoffRequests.find((h) => h.status === 'PENDING') ?? null;
  const directoryById = new Map(directory.map((u) => [u.id, u.fullName]));


  // Sekcija sa više od pet redova se skraćuje na skrol, a u zaglavlje dobija link ka kartici na
  // kojoj se vidi ceo sadržaj (2.9.2026, na zahtev vlasnika). Broj u linku je jedini signal da
  // ispod vidljivih redova ima još — skrol traka je namerno nevidljiva.
  // Svaka sekcija Pregleda vodi na svoju karticu (2.9.2026, na zahtev vlasnika) — `href` je
  // uvek prisutan, a `linkLabel` (broj) samo kad je spisak skraćen na skrol, jer je tada broj
  // jedini znak da ispod ima još sadržaja.
  const tabHref = (tab: string) => `/rezervacije/${params.id}?tab=${tab}`;
  const sectionLink = (tab: string, tabLabel: string, count?: number) => ({
    href: tabHref(tab),
    linkTitle: `Otvori u celosti — kartica ${tabLabel}`,
    ...(count !== undefined && count > OVERVIEW_ROW_LIMIT ? { linkLabel: `svi (${count})` } : {}),
  });

  // ---- Izvedene vrednosti za sažetak na vrhu novog izgleda (dizajn dok. §6h) ----
  // Računaju se ovde, a ne u `BookingOverviewHero`, da komponenta ostane čisto prikazna —
  // isti obrazac kao ostatak ovog ekrana (podaci se dohvate i izvedu u server komponenti).
  const stayFroms = (booking?.items ?? []).map((i) => i.stayFrom).filter((d): d is string => Boolean(d));
  const stayTos = (booking?.items ?? []).map((i) => i.stayTo).filter((d): d is string => Boolean(d));
  const tripFrom = stayFroms.length > 0 ? stayFroms.sort()[0] : null;
  const tripTo = stayTos.length > 0 ? stayTos.sort()[stayTos.length - 1] : null;
  // Broj putnika je broj RAZLIČITIH ljudi na rezervaciji, ne zbir po stavkama — isti putnik
  // na hotelu i na transferu je jedan putnik, a zbir bi ga brojao dvaput (na primeru sa dva
  // putnika i dve usluge to bi dalo "4 putnika", što je pogrešan podatak, ne samo ružan).
  const uniqueGuestKeys = new Set(
    (booking?.items ?? []).flatMap((i) =>
      (i.guests ?? []).map((g) => g.guestProfileId ?? `${g.guestFirstName ?? ''} ${g.guestLastName ?? ''}`.trim().toLowerCase()),
    ),
  );
  const guestCount = uniqueGuestKeys.size;
  const itemsWithGuests = (booking?.items ?? []).filter((i) => (i.guests?.length ?? 0) > 0).length;
  const guestSummaryMeta =
    guestCount === 0
      ? undefined
      : itemsWithGuests > 1
        ? `${guestCount} · na ${itemsWithGuests} usluge`
        : String(guestCount);

  const balance = (booking?.totalPrice ?? 0) - paidTotal;
  // Nosilac rezervacije se prikazuje ODVOJENO od vlasnika/zaduženog (2.9.2026, na zahtev
  // vlasnika) — to su tri različite osobe u tri različite uloge, a do sada su stajale u jednom
  // nizu razdvojene tačkicama, u istoj veličini i boji. Gost je taj po kome se rezervacija
  // traži; vlasnik i zaduženi su interna raspodela posla.
  const holderName = clientAccount
    ? ((clientAccount.accountType === 'LEGAL_ENTITY' ? clientAccount.companyName : clientAccount.fullName) ?? null)
    : null;
  const overviewSubtitle = [
    booking?.ownerId ? `vlasnik ${directoryById.get(booking.ownerId) ?? '—'}` : null,
    booking?.assignedToId ? `zadužen ${directoryById.get(booking.assignedToId) ?? '—'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Preplaćeno je posebno stanje, ne "plaćeno sa viškom": traži povraćaj, prebijanje na drugu
  // rezervaciju ili ispravku knjiženja. Zatečeni izgled ga je prikazivao ZELENOM bojom kao
  // negativan "preostalo" iznos — zeleno saopštava "sve u redu", dakle suprotno od stvarnog
  // stanja. Zato ovde ima sopstvenu oznaku i boju upozorenja (2.9.2026, nalaz uz redizajn).
  const overpaid = balance < 0;
  const overviewBadges: { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' }[] = booking
    ? [
        {
          label: booking.status,
          tone: booking.status === 'CONFIRMED' ? 'ok' : booking.status === 'CANCELLED' ? 'danger' : 'neutral',
        },
        overpaid
          ? { label: 'PREPLAĆENO', tone: 'warn' as const }
          : {
              label: booking.paymentStatus,
              tone: booking.paymentStatus === 'PAID' ? ('ok' as const) : booking.paymentStatus === 'UNPAID' ? ('danger' as const) : ('neutral' as const),
            },
      ]
    : [];

  const overviewFacts: HeroFact[] = booking
    ? [
        {
          label: 'Termin',
          value: tripFrom ? `${new Date(tripFrom).toLocaleDateString('sr-RS')} — ${tripTo ? new Date(tripTo).toLocaleDateString('sr-RS') : '—'}` : '—',
          note: tripFrom && tripTo ? `${nightsBetween(tripFrom, tripTo)} noćenja` : undefined,
          compact: true,
        },
        {
          label: 'Putnika',
          value: guestCount > 0 ? String(guestCount) : '—',
          note: `${booking.items.length} ${booking.items.length === 1 ? 'usluga' : 'usluge'}`,
        },
        ...(canViewPayments
          ? [
              { label: 'Ukupna cena', value: formatMoney(booking.totalPrice ?? 0), note: booking.currency },
              {
                label: 'Uplaćeno',
                value: formatMoney(paidTotal),
                note: `${booking.currency ?? ''}${payments.length > 0 ? ` · ${payments.length} ${payments.length === 1 ? 'uplata' : 'uplate'}` : ''}`,
              },
              overpaid
                ? {
                    label: 'Preplaćeno',
                    value: formatMoney(Math.abs(balance)),
                    note: `${booking.currency ?? ''} · traži povraćaj ili prebijanje`,
                    tone: 'warn' as const,
                  }
                : {
                    label: 'Preostalo',
                    value: formatMoney(balance),
                    note: booking.currency,
                    tone: balance > 0 ? ('danger' as const) : ('default' as const),
                  },
            ]
          : []),
      ]
    : [];

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
              server-komponenta (bez povlačenja podataka koje ta kartica ne traži). Dopuna
              (2.9.2026, na zahtev vlasnika: "u kom god tabu da se nalazimo... svi tabovi treba
              da budu uvek vidljivi") — `sticky top-0`, isti obrazac kao filter traka u
              `rezervacije/lista/BookingsListClient.tsx`; `<main>` (Shell.tsx) je scroll
              kontejner, pa `top-0` lepi traku za njegov vrh bez obzira koliko je sadržaj kartice
              dugačak. */}
          <nav className="sticky top-0 z-20 mb-4 flex flex-wrap gap-1 border-b border-border bg-panel pt-1">
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

          {activeTab === 'pregled' && me && overviewLayout === 'klasicni' && (
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

          {/* Dopuna (2.9.2026, na zahtev vlasnika: "u tabu Pregled treba da se vide svi bitni
              podaci... ovde se ništa ne menja samo se prikazuje") — Pregled od sada agregira
              ISTO što svaka pojedinačna kartica prikazuje, u čisto read-only obliku (bez formi za
              kreiranje/dodelu/otkazivanje — za to se i dalje ide na tu karticu). */}
          {/* Prekidač izgleda — stoji na samom vrhu kartice Pregled, ne u globalnim
              podešavanjima: tiče se samo ovog ekrana i postoji samo dok traje poređenje. */}
          {activeTab === 'pregled' && (
            <div className="mb-3 flex justify-end">
              <OverviewLayoutSwitch current={overviewLayout} />
            </div>
          )}

          {activeTab === 'pregled' && overviewLayout === 'klasicni' && (
            <div className="space-y-6">
              <Section title="Aranžman">
                <ItemsSummaryList items={booking.items} currency={booking.currency} />
              </Section>

              {(canPrepareFiscal || canViewRegistrations || canViewContracts || canViewClientAccount) && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

              <Section title="Putnici">
                <GuestsSummaryList items={booking.items} guestProfilesById={guestProfilesById} canViewGuestProfiles={canViewGuestProfiles} />
              </Section>

              {canViewPayments && (
                <Section title="Finansije">
                  <PaymentsSummaryBlock payments={payments} totalPrice={booking.totalPrice ?? 0} paidTotal={paidTotal} currency={booking.currency} />
                </Section>
              )}

              {canViewCommunication && booking.clientAccountId && (
                <Section title="Komunikacija">
                  <CommunicationSummaryList communications={communications} directoryById={directoryById} />
                </Section>
              )}

              <Section title="Beleške">
                <NotesSummaryList notes={notes} directoryById={directoryById} />
              </Section>

              {canViewTickets && (
                <Section title="Reklamacije">
                  <TicketsSummaryList tickets={tickets} />
                </Section>
              )}

              <Section title="Predstavnici">
                <RepsSummaryList items={booking.items} checkIns={checkIns} directoryById={directoryById} guides={guides} canViewCheckIns={canViewCheckIns} />
              </Section>
            </div>
          )}

          {/* ============================================================================
              NOV IZGLED kartice Pregled (2.9.2026, dizajn dok. §6h) — isti podaci i iste
              dozvole kao klasičan blok iznad, promenjena je isključivo težina svakog dela:
              sažetak (krupno) → sekcija sa naslovom → red u listi. Okvir nose samo sažetak i
              ono na šta se klikne. Vidi `OverviewLayoutSwitch.tsx` — jedan od dva izgleda se
              briše čim vlasnik odluči, ovo nije trajno stanje kod-baze.
              ============================================================================ */}
          {activeTab === 'pregled' && overviewLayout === 'novi' && (
            <div>
              <BookingOverviewHero
                bookingNumber={booking.bookingNumber}
                holderName={holderName}
                subtitle={overviewSubtitle}
                badges={overviewBadges}
                facts={overviewFacts}
              />

              {/* Levo ono što JESTE rezervacija (usluge, putnici), desno ono što je oko nje
                  (novac, veze ka drugim modulima). Bez ovoga oko putuje preko cele širine
                  ekrana za svaki red. `xl:` a ne `lg:` — na 1024px dve kolone stisnu tabelu
                  uplata do prelamanja iznosa. */}
              {/* Jednake kolone (2.9.2026, na zahtev vlasnika: "leva i desna strana neka budu
                  iste širine") — poništava raniji odnos 1.5:1. Desna kolona je u međuvremenu
                  dobila dovoljno sadržaja (uplate, povezano, reklamacije, predstavnici,
                  vlasništvo) da uža kolona više nije bila opravdana. */}
              <div className="grid gap-x-7 gap-y-6 xl:grid-cols-2">
                <div className="space-y-6">
                  <OverviewSection
                    title="Aranžman"
                    icon="package"
                    meta={`${booking.items.length} ${booking.items.length === 1 ? 'usluga' : 'usluge'} · ${formatMoney(booking.totalPrice ?? 0, booking.currency)}`}
                    {...sectionLink('aranzman', 'Aranžman', booking.items.length)}
                  >
                    {/* `max-h` je usklađen sa VISINOM REDA te sekcije, ne jedna vrednost za sve —
                        red usluge je viši (naziv + red detalja) od reda uplate, pa bi ista visina
                        negde presekla peti red na pola, što izgleda kao greška u prikazu. */}
                    <ScrollableRows limited={booking.items.length > OVERVIEW_ROW_LIMIT} maxHeight="max-h-[19rem]">
                      <ItemsSummaryList items={booking.items} currency={booking.currency} flat />
                    </ScrollableRows>
                  </OverviewSection>

                  <OverviewSection title="Putnici" icon="organization" meta={guestSummaryMeta} {...sectionLink('putnici', 'Putnici', guestCount)}>
                    <ScrollableRows limited={guestCount > OVERVIEW_ROW_LIMIT} maxHeight="max-h-[11rem]">
                      <GuestsSummaryList
                        items={booking.items}
                        guestProfilesById={guestProfilesById}
                        canViewGuestProfiles={canViewGuestProfiles}
                        flat
                      />
                    </ScrollableRows>
                  </OverviewSection>

                  {canViewPayments && (
                    <OverviewSection
                      title="Uplate"
                      icon="credit-card"
                      meta={`${payments.length} · ${formatMoney(paidTotal, booking.currency)}`}
                      {...sectionLink('finansije', 'Finansije', payments.length)}
                    >
                      {/* Tri velika iznosa (ukupno/uplaćeno/preostalo) su preseljena u sažetak
                          na vrhu — ovde ostaje samo spisak pojedinačnih uplata, da isti broj ne
                          stoji dvaput na istom ekranu u dve različite veličine. */}
                      <ScrollableRows limited={payments.length > OVERVIEW_ROW_LIMIT} maxHeight="max-h-[11rem]">
                        <PaymentsSummaryBlock
                          payments={payments}
                          totalPrice={booking.totalPrice ?? 0}
                          paidTotal={paidTotal}
                          currency={booking.currency}
                          flat
                        />
                      </ScrollableRows>
                      {canPrepareFiscal && (
                        <div className="mt-2.5">
                          <PrepareFiscalDocumentButton bookingId={booking.id} quiet />
                        </div>
                      )}
                    </OverviewSection>
                  )}

                  {(canViewClientAccount || canViewRegistrations || canViewContracts) && (
                    <OverviewSection title="Povezano" icon="link">
                      <div className="-mx-2">
                        {canViewClientAccount &&
                          (clientAccount ? (
                            <RelatedRow
                              code="M6"
                              title={
                                (clientAccount.accountType === 'LEGAL_ENTITY' ? clientAccount.companyName : clientAccount.fullName) ?? 'nalogodavac'
                              }
                              href={`/crm/${clientAccount.id}`}
                              actionLabel="profil"
                            />
                          ) : (
                            <RelatedRow code="M6" title="Nalogodavac nije povezan ili nije dostupan." />
                          ))}

                        {canViewRegistrations &&
                          (registrations.length === 0 ? (
                            <RelatedRow code="M11" title="Bez CIS registracije (nije ORGANIZATOR tip)." />
                          ) : (
                            registrations.map((r) => (
                              <RelatedRow
                                key={r.id}
                                code="M11"
                                title="Garancija putovanja"
                                meta={`${r.status}${r.cisRegistrationNumber ? ` · ${r.cisRegistrationNumber}` : ''}`}
                                href="/compliance"
                                actionLabel="otvori"
                              />
                            ))
                          ))}

                        {canViewContracts &&
                          (contracts.filter((c) => c.status !== 'VOIDED').length === 0 ? (
                            <RelatedRow code="M20" title="Ugovor još nije generisan." />
                          ) : (
                            contracts
                              .filter((c) => c.status !== 'VOIDED')
                              .map((c) => (
                                <RelatedRow
                                  key={c.id}
                                  code="M20"
                                  title="Ugovor sa klijentom"
                                  meta={`${c.status} · ${c.contractType}`}
                                  href={`/ugovori-klijenti/${c.id}`}
                                  actionLabel="otvori"
                                />
                              ))
                          ))}
                      </div>
                    </OverviewSection>
                  )}

                </div>

                <div className="space-y-6">
                  <OverviewSection title="Beleške" icon="file-text" meta={notes.length > 0 ? String(notes.length) : undefined} {...sectionLink('beleske', 'Beleške', notes.length)}>
                    <ScrollableRows limited={notes.length > OVERVIEW_ROW_LIMIT} maxHeight="max-h-[22rem]">
                      <NotesSummaryList notes={notes} directoryById={directoryById} flat />
                    </ScrollableRows>
                  </OverviewSection>

                  {canViewCommunication && booking.clientAccountId && (
                    <OverviewSection
                      title="Komunikacija"
                      icon="comment-discussion"
                      meta={communications.length > 0 ? String(communications.length) : undefined}
                      {...sectionLink('komunikacija', 'Komunikacija', communications.length)}
                    >
                      <ScrollableRows limited={communications.length > OVERVIEW_ROW_LIMIT} maxHeight="max-h-[22rem]">
                        <CommunicationSummaryList communications={communications} directoryById={directoryById} flat />
                      </ScrollableRows>
                    </OverviewSection>
                  )}

                  {canViewTickets && (
                    <OverviewSection
                      title="Reklamacije"
                      icon="warning"
                      meta={tickets.length > 0 ? String(tickets.length) : undefined}
                      {...sectionLink('reklamacije', 'Reklamacije', tickets.length)}
                    >
                      <ScrollableRows limited={tickets.length > OVERVIEW_ROW_LIMIT} maxHeight="max-h-[22rem]">
                        <TicketsSummaryList tickets={tickets} flat />
                      </ScrollableRows>
                    </OverviewSection>
                  )}

                  <OverviewSection title="Predstavnici" icon="account" {...sectionLink('predstavnici', 'Predstavnici', booking.items.length)}>
                    <RepsSummaryList
                      items={booking.items}
                      checkIns={checkIns}
                      directoryById={directoryById}
                      guides={guides}
                      canViewCheckIns={canViewCheckIns}
                      flat
                    />
                  </OverviewSection>

                  {/* Prenos vlasništva / predaja zaduženja — iste forme, samo više nisu na vrhu
                      ekrana. Koriste se retko, a zauzimale su prvi ekran iznad svega. */}
                  {me && (
                    <OverviewSection title="Vlasništvo i zaduženje" icon="bookmark">
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
                        flat
                      />
                    </OverviewSection>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* M5 spec §4.5/§6 — Aranžman: šta je stvarno kupljeno. Do 1.9.2026 je ovaj ekran
              prikazivao samo skraćen `productId` (sirov UUID), bez naziva, datuma i broja jedinica.
              Dopuna (2.9.2026, na zahtev vlasnika) — ikonica tipa proizvoda umesto teksta, ukupno
              zaduženje svih stavki, i izmena usluge/datuma po stavci uz prethodnu proveru cene
              (isti `POST /bookings/:id/modify` kao kartica Izmene, prošireno opcionim `productId`). */}
          {activeTab === 'aranzman' && (
            <div className="space-y-3">
              {booking.items.length === 0 ? (
                <p className="text-xs text-ink-faint">Rezervacija nema nijednu stavku.</p>
              ) : (
                <>
                  <StatCard label="Ukupno zaduženje (aktivne stavke)" value={formatMoney(booking.totalPrice ?? 0, booking.currency)} />
                  {/* M5 spec §6.7a — iznos koji gost plaća DOBAVLJAČU na licu mesta ne ulazi u
                      ukupno zaduženje (agencija ga nikad ne naplati), ali se ne sme ni sakriti:
                      prećutan trošak na licu mesta je najbrži put do reklamacije. Prikazuje se
                      samo kad ga stvarno ima. */}
                  {onSiteTotal > 0 && (
                    <StatCard label="Plaća se na licu mesta (ne ulazi u zaduženje)" value={formatMoney(onSiteTotal, booking.currency)} />
                  )}
                  {booking.items
                    .filter((i) => !i.parentItemId)
                    .map((item) => (
                    <AranzmanItemCard
                      key={item.id}
                      bookingId={booking.id}
                      item={{
                        id: item.id,
                        productId: item.productId,
                        name: item.product?.name ?? `stavka ${item.id.slice(0, 8)}…`,
                        type: item.product?.type ?? '',
                        destinationCity: item.product?.destinationCity ?? null,
                        destinationArea: item.product?.destinationArea ?? null,
                        destinationCountry: item.product?.destinationCountry ?? null,
                        finalPrice: item.finalPrice,
                        finalPriceCurrency: item.finalPriceCurrency ?? booking.currency,
                        itemStatus: item.itemStatus,
                        stayFrom: item.stayFrom,
                        stayTo: item.stayTo,
                        unitCount: item.unitCount,
                        guestCount: item.guests?.length ?? 0,
                        supplierReference: item.supplierReference,
                      }}
                      candidates={item.product?.type ? (candidatesByType.get(item.product.type) ?? []) : []}
                      canModify={canModifyBooking}
                      // §6.7a — vezane doplate/popusti idu UZ svoju stavku, ne kao samostalni redovi.
                      ancillaries={booking.items
                        .filter((a) => a.parentItemId === item.id)
                        .map((a) => ({
                          id: a.id,
                          name: a.ancillaryService?.name ?? a.product?.name ?? 'doplata',
                          finalPrice: a.finalPrice,
                          finalPriceCurrency: a.finalPriceCurrency ?? booking.currency,
                          itemStatus: a.itemStatus,
                          payable: a.payable,
                          unitCount: a.unitCount,
                        }))}
                    />
                  ))}
                </>
              )}

              {/* M5 spec §6.7 (3.9.2026, na zahtev vlasnika) — dodavanje NOVE usluge. Stoji ispod
                  spiska stavki, i kad stavki nema: dodavanje ne zavisi od toga da li već nešto
                  postoji. Ne prikazuje se na otkazanoj rezervaciji (§6.7) i bez dozvole za
                  izmenu — nikad kao neaktivno sivo dugme. */}
              {canModifyBooking && booking.status !== 'CANCELLED' && (
                <AddServicePanel
                  bookingId={booking.id}
                  defaults={{
                    stayFrom: booking.items.find((i) => i.stayFrom)?.stayFrom,
                    stayTo: booking.items.find((i) => i.stayTo)?.stayTo,
                    adults: booking.items[0]?.guests?.length || 1,
                    children: 0,
                  }}
                />
              )}
            </div>
          )}

          {/* M5 spec §4.5/§4.3 — Putnici: `BookingItemGuest` po stavci. Ime/prezime dolaze iz M5 i
              sad se mogu dodavati/menjati/brisati direktno ovde (dopuna 2.9.2026, na zahtev
              vlasnika — "ovo nema veze sa profilom putnika"); dokument/državljanstvo/datum
              rođenja su M6 podatak, i dalje samo za čitanje, dohvataju se samo uz
              `M6/guest-profile/VIEW` (isti obrazac kao ostale kartice — bez dozvole se ne prikazuju). */}
          {activeTab === 'putnici' && (
            <div className="space-y-3">
              {booking.items
                .filter((i) => i.itemStatus !== 'CANCELLED')
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
                    <BookingItemGuestsEditor
                      bookingId={booking.id}
                      bookingItemId={item.id}
                      guests={item.guests ?? []}
                      profilesById={guestProfilesById}
                      canViewGuestProfiles={canViewGuestProfiles}
                      canModify={canModifyBooking}
                    />
                  </div>
                ))}
            </div>
          )}

          {/* M5 spec §4.5/§5 dopuna (2.9.2026, na zahtev vlasnika: "Loša je odluka da se uplate
              unose na nekom drugom mestu... uplate treba evidentirati u svakoj rezervaciji u
              tabu Finansije, a te informacije posle treba da idu dalje gde treba") — unos ostaje
              M10 (`POST /finance/payments`, isti zapis kao ekran "Fiskalni dokumenti" pod
              /finansije — JEDAN izvor istine, dva mesta unosa u NJEGA), samo se sad forma za
              unos nalazi i ovde, ne samo tamo. */}
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
                {canRecordPayment && (
                  <RecordPaymentForm bookingId={booking.id} currency={booking.currency ?? 'EUR'} revalidatePath={`/rezervacije/${booking.id}?tab=finansije`} banks={banks} />
                )}
                {payments.length === 0 ? (
                  <p className="text-xs text-ink-faint">Nema evidentiranih uplata za ovu rezervaciju.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-border">
                    {payments.map((p) => (
                      <PaymentRow
                        key={p.id}
                        payment={p}
                        bookingId={booking.id}
                        currency={booking.currency ?? 'EUR'}
                        revalidatePath={`/rezervacije/${booking.id}?tab=finansije`}
                        banks={banks}
                        variant="detailed"
                      />
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-ink-faint">
                  Uplata zabeležena ovde ide u M10 (Finansije) — isti zapis se odatle dalje koristi za fiskalizaciju i izveštaje; M5 ne drži sopstvenu evidenciju plaćanja (M5 spec §5).
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
                <CommunicationFilterList
                  communications={communications}
                  bookingNumber={booking.bookingNumber}
                  directoryNames={Object.fromEntries(directoryById)}
                />
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

          {/* M5 spec §6/§6.4 — Izmene: otkazivanje i izmena datuma/broja osoba. */}
          {activeTab === 'izmene' && (
            <BookingChangesCard
              bookingId={booking.id}
              items={booking.items.map((i) => ({
                id: i.id,
                name: i.product?.name ?? `stavka ${i.id.slice(0, 8)}…`,
                stayFrom: i.stayFrom,
                stayTo: i.stayTo,
                itemStatus: i.itemStatus,
                guestCount: i.guests?.length ?? 0,
              }))}
              canCancel={canCancelBooking}
              canModify={canModifyBooking}
            />
          )}

          {/* M5 spec §4.5 — Reklamacije: prikaz nad M14 `Ticket.related_booking_id`, koji je u
              modelu postojao od početka ali se nigde nije prikazivao na rezervaciji. */}
          {activeTab === 'reklamacije' &&
            (!canViewTickets ? (
              <p className="text-xs text-ink-faint">
                Nemate dozvolu za uvid u tikete (<code>M14/ticket/VIEW</code>).
              </p>
            ) : (
              <div className="space-y-3">
                {canCreateTicket && (
                  <Link
                    href={`/podrska/novi?bookingId=${booking.id}`}
                    className="inline-flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong"
                  >
                    <Icon name="add" /> Otvori reklamaciju za ovu rezervaciju
                  </Link>
                )}
                {tickets.length === 0 ? (
                  <p className="text-xs text-ink-faint">Nema nijedne reklamacije ni tiketa vezanog za ovu rezervaciju.</p>
                ) : (
                  <ul className="space-y-2">
                    {tickets.map((t) => (
                      <li key={t.id} className="rounded-lg border border-border bg-panel p-3">
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="font-mono text-ink">{t.ticketNumber}</span>
                          <Badge label={t.status} />
                          <Badge label={t.category} />
                          <Badge label={t.priority} />
                          {/* §3.1 — zakonski rok za odgovor na reklamaciju (8 dana). */}
                          {t.zzpResponseDeadline && (
                            <span className={new Date(t.zzpResponseDeadline) < new Date() ? 'text-danger' : 'text-warn'}>
                              rok po ZZP: {new Date(t.zzpResponseDeadline).toLocaleDateString('sr-RS')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-ink">{t.subject}</span>
                          <Link href={`/podrska/${t.id}`} className="shrink-0 text-xs text-accent hover:underline">
                            otvori tiket →
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

          {/* M5 spec §4.5 / M9 §4 — Predstavnici: dodela vodiča po stavci + prijave sa terena. */}
          {activeTab === 'predstavnici' && (
            <BookingRepsCard
              bookingId={booking.id}
              items={booking.items
                .filter((i) => i.itemStatus !== 'CANCELLED')
                .map((i) => ({
                  id: i.id,
                  name: i.product?.name ?? `stavka ${i.id.slice(0, 8)}…`,
                  destination: [i.product?.destinationCity, i.product?.destinationArea, i.product?.destinationCountry].filter(Boolean).join(', ') || null,
                  stayFrom: i.stayFrom,
                  stayTo: i.stayTo,
                  assignedGuideId: i.assignedGuideId ?? null,
                  guestCount: i.guests?.length ?? 0,
                }))}
              guides={guides}
              checkIns={checkIns}
              namesById={Object.fromEntries([...directoryById, ...guides.map((g) => [g.id, g.fullName] as const)])}
              canAssign={canModifyBooking}
              canViewCheckIns={canViewCheckIns}
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

// ==========================================================================
// M5 spec §4.5 dopuna (2.9.2026, na zahtev vlasnika) — kartica Pregled agregira sve ostale
// kartice u čisto read-only obliku. Funkcije ispod se koriste ISKLJUČIVO tu (svaka sopstvena
// kartica zadržava sopstveni, interaktivni prikaz nepromenjeno) — nema forme, dugmeta za
// kreiranje/dodelu/otkazivanje ovde, samo prikaz.
// ==========================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</h2>
      {children}
    </div>
  );
}

// `flat` (2.9.2026, nov izgled Pregleda — dizajn dok. §6h): isti podaci bez sopstvenog okvira,
// kao redovi liste razdvojeni tankom linijom. Okvir po stavci je smislen na kartici Aranžman,
// gde je svaka stavka nešto što se menja; na Pregledu je stavka samo podatak koji se čita, pa
// deset okvira na ekranu čini da ništa ne izgleda važnije od bilo čega drugog.
function ItemsSummaryList({ items, currency, flat }: { items: BookingItem[]; currency?: string; flat?: boolean }) {
  if (items.length === 0) return <p className="text-xs text-ink-faint">Rezervacija nema nijednu stavku.</p>;
  if (flat) {
    return (
      <div className="divide-y divide-border">
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-start gap-2.5 py-2.5">
            <span title={item.product?.type} className="mt-0.5 flex-shrink-0 text-accent">
              <Icon name={PRODUCT_ICONS.find((p) => p.types.includes(item.product?.type ?? ''))?.icon ?? 'question'} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-ink">
                {item.product?.name ?? <span className="text-ink-faint">naziv proizvoda nije dostupan</span>}
              </div>
              {/* Destinacija/država i tip smeštaja u sopstvenim redovima, termin/noćenja/putnici
                  ispod kao rečenica (2.9.2026) — to je ono što je stvarno kupljeno i ono oko
                  čega gost najčešće zove ("da li imam doručak?"), pa ne sme da se izgubi na
                  kraju niza tačkica. Prikazuje se samo kad postoji: za stavke iz spoljnog API-ja
                  (M4) roomType/boardType nema i taj red se ne crta.
                  Oba gornja reda su bila tiša (11px, `ink-faint`) od reda uplate u susednoj
                  kutiji (13px, `ink-dim`) — iako je ovo najvažniji podatak na ekranu, ispalo je
                  manje čitljivo od manje bitnog detalja (4.9.2026, na zahtev vlasnika: "u
                  stavkama su mala slova jedva vidljivi nazivi država i destinacija, tipova
                  smeštaja"). Sad su na `text-xs`/`ink-dim` — ista težina kao red uplate; termin/
                  noćenja/putnici ostaju sitniji (`text-[11px]`) jer su stvarno sekundaran detalj
                  u odnosu na šta/gde, ali dele istu boju/debljinu radi čitljivosti.
                  Sva tri reda `font-semibold` (4.9.2026, na zahtev vlasnika, u dva koraka —
                  prvo `font-medium` nije bilo dovoljno vidljivo: "meni tako ne deluje"; isto
                  `font-semibold` kao naziv proizvoda iznad, radi jasne, nedvosmislene razlike u
                  odnosu na normalan tekst). Treći red prebačen sa `ink-faint` na `ink-dim`
                  istom prilikom — razlika između te dve nijanse nije bila dovoljno uočljiva da
                  opravda zadržavanje najbleđeg tona na ijednom od tri reda. */}
              <div className="mt-0.5 text-xs font-semibold text-ink-dim">
                {[item.product?.destinationCity, item.product?.destinationArea, formatCountry(item.product?.destinationCountry)].filter(Boolean).join(', ')}
              </div>
              {(item.roomType || item.boardType) && (
                <div className="mt-0.5 text-xs font-semibold text-ink-dim">
                  {[formatRoomType(item.roomType), formatBoard(item.boardType), formatOccupancy(item.occupancy)]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
              <div className="mt-0.5 text-[11px] font-semibold text-ink-dim">
                {[
                  item.stayFrom
                    ? `${new Date(item.stayFrom).toLocaleDateString('sr-RS')}${item.stayTo && item.stayTo !== item.stayFrom ? ` — ${new Date(item.stayTo).toLocaleDateString('sr-RS')}` : ''}`
                    : null,
                  nightsBetween(item.stayFrom, item.stayTo) !== '—' ? `${nightsBetween(item.stayFrom, item.stayTo)} noćenja` : null,
                  (item.guests?.length ?? 0) > 0 ? `${item.guests?.length} putnika` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="font-mono text-[13px] font-semibold text-ink">
                {formatMoney(item.finalPrice, item.finalPriceCurrency ?? currency)}
              </div>
              <div className="mt-1">
                <Badge label={item.itemStatus} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-border bg-panel p-3">
          <div className="mb-1.5 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <span title={item.product?.type} className="mt-0.5 text-accent">
                <Icon name={PRODUCT_ICONS.find((p) => p.types.includes(item.product?.type ?? ''))?.icon ?? 'question'} />
              </span>
              <div>
                <div className="text-sm font-semibold text-ink">{item.product?.name ?? <span className="text-ink-faint">naziv proizvoda nije dostupan</span>}</div>
                <div className="mt-0.5 text-xs text-ink-faint">
                  {[item.product?.destinationCity, item.product?.destinationArea, formatCountry(item.product?.destinationCountry)].filter(Boolean).join(', ')}
                </div>
                {/* Isti podaci i u zatečenom izgledu — dva izgleda iste kartice ne smeju da se
                    raziđu po SADRŽAJU, samo po rasporedu (vidi `OverviewLayoutSwitch.tsx`). */}
                {(item.roomType || item.boardType) && (
                  <div className="mt-0.5 text-xs text-ink-dim">
                    {[formatRoomType(item.roomType), formatBoard(item.boardType), formatOccupancy(item.occupancy)]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-semibold text-ink">{formatMoney(item.finalPrice, item.finalPriceCurrency ?? currency)}</span>
              <Badge label={item.itemStatus} />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
            <Field label="Od" value={item.stayFrom ? new Date(item.stayFrom).toLocaleDateString('sr-RS') : '—'} />
            <Field label="Do" value={item.stayTo ? new Date(item.stayTo).toLocaleDateString('sr-RS') : '—'} />
            <Field label="Noćenja" value={nightsBetween(item.stayFrom, item.stayTo)} />
            <Field label="Putnika" value={String(item.guests?.length ?? 0)} />
          </dl>
        </div>
      ))}
    </div>
  );
}

function GuestsSummaryList({
  items,
  guestProfilesById,
  canViewGuestProfiles,
  flat,
}: {
  items: BookingItem[];
  guestProfilesById: Map<string, GuestProfileSummary>;
  canViewGuestProfiles: boolean;
  flat?: boolean;
}) {
  const withGuests = items.filter((i) => (i.guests?.length ?? 0) > 0);
  if (withGuests.length === 0) return <p className="text-xs text-ink-faint">Na rezervaciji nema unetih putnika.</p>;
  if (flat) {
    // Isti putnik se u zatečenom izgledu ponavljao pod SVAKOM uslugom (dva putnika na dve
    // usluge = četiri reda), pa je spisak izgledao duplo duži nego što stvarno jeste. Ovde se
    // objedinjuje po osobi, a razlika između usluga se prikazuje samo ako stvarno postoji —
    // podatak "ko putuje na čemu" se ne gubi, samo ne zauzima prostor kad je svuda isti.
    const byPerson = new Map<string, { first?: string; last?: string; profileId?: string | null; items: string[] }>();
    for (const item of withGuests) {
      for (const g of item.guests ?? []) {
        const key = g.guestProfileId ?? `${g.guestFirstName ?? ''} ${g.guestLastName ?? ''}`.trim().toLowerCase();
        const entry = byPerson.get(key) ?? { first: g.guestFirstName, last: g.guestLastName, profileId: g.guestProfileId, items: [] };
        entry.items.push(item.product?.name ?? 'stavka');
        byPerson.set(key, entry);
      }
    }
    const people = [...byPerson.values()];
    const naSvima = people.every((p) => p.items.length === withGuests.length);
    return (
      <div>
        <div className="divide-y divide-border">
          {people.map((p, idx) => {
            const profile = p.profileId ? guestProfilesById.get(p.profileId) : null;
            return (
              <div key={p.profileId ?? idx} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className="text-[13px] text-ink">
                  {p.first} {p.last}
                  {!naSvima && <span className="ml-1.5 text-[11px] text-ink-faint">· {p.items.join(', ')}</span>}
                </span>
                {profile ? (
                  <span className="font-mono text-[10px] text-ink-faint">
                    {profile.documentType} {profile.documentNumber} · {profile.nationality}
                  </span>
                ) : (
                  <span className="text-[11px] text-ink-faint">
                    {p.profileId ? (canViewGuestProfiles ? '—' : 'zahteva M6/guest-profile/VIEW') : 'bez povezanog profila'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {naSvima && withGuests.length > 1 && (
          <div className="mt-1.5 text-[10px] text-ink-faint">Isti putnici na svim uslugama.</div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {withGuests.map((item) => (
        <div key={item.id} className="rounded-lg border border-border bg-panel p-3">
          <div className="mb-1.5 text-xs font-semibold text-ink">{item.product?.name ?? 'stavka'}</div>
          <ul className="divide-y divide-border">
            {(item.guests ?? []).map((g) => {
              const profile = g.guestProfileId ? guestProfilesById.get(g.guestProfileId) : null;
              return (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="text-ink">
                    {g.guestFirstName} {g.guestLastName}
                  </span>
                  {profile ? (
                    <span className="text-xs text-ink-faint">
                      {profile.documentType} {profile.documentNumber} · {profile.nationality}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-faint">{g.guestProfileId ? (canViewGuestProfiles ? '—' : 'zahteva M6/guest-profile/VIEW') : 'bez povezanog profila'}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PaymentsSummaryBlock({
  payments,
  totalPrice,
  paidTotal,
  currency,
  flat,
}: {
  payments: Payment[];
  totalPrice: number;
  paidTotal: number;
  currency?: string;
  flat?: boolean;
}) {
  // `flat` izostavlja tri velike brojke (ukupno/uplaćeno/preostalo) jer one u novom izgledu
  // stoje u sažetku na vrhu ekrana — bez ovoga bi isti iznos stajao dvaput na istom ekranu,
  // u dve različite veličine, što je gore nego da nije nigde istaknut.
  if (flat) {
    if (payments.length === 0) return <p className="text-xs text-ink-faint">Nema evidentiranih uplata za ovu rezervaciju.</p>;
    return (
      <div className="divide-y divide-border">
        {payments.map((p) => (
          <div key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5 text-[13px]">
            <span className="text-ink-dim">
              {p.method}
              {p.bank && ` · ${p.bank.name}`}
              {p.checkDetails && p.checkDetails.length > 0 && ` · ${p.checkDetails.length} ${p.checkDetails.length === 1 ? 'ček' : 'čeka'}`}
              <span className="ml-1 text-[11px] text-ink-faint">{new Date(p.receivedAt ?? p.createdAt).toLocaleDateString('sr-RS')}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="font-mono font-semibold text-ink">{formatMoney(p.amount, p.currency)}</span>
              <Badge label={p.status} />
              {p.checkDetails && p.checkDetails.length > 0 && (
                <a href={`/finansije/uplate/${p.id}`} target="_blank" rel="noreferrer" className="text-[11px] text-accent hover:underline">
                  specifikacija →
                </a>
              )}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Ukupna cena" value={formatMoney(totalPrice, currency)} />
        <StatCard label="Uplaćeno" value={formatMoney(paidTotal, currency)} />
        <StatCard label="Preostalo" value={formatMoney(totalPrice - paidTotal, currency)} tone={totalPrice - paidTotal > 0 ? 'danger' : 'ok'} />
      </div>
      {payments.length === 0 ? (
        <p className="text-xs text-ink-faint">Nema evidentiranih uplata za ovu rezervaciju.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-border bg-panel px-4 py-2.5 text-sm last:border-b-0">
              <span className="text-ink">
                {p.method}
                {p.bank && ` · ${p.bank.name}`}
                {p.checkDetails && p.checkDetails.length > 0 && ` · ${p.checkDetails.length} ${p.checkDetails.length === 1 ? 'ček' : 'čeka'}`}{' '}
                <span className="text-xs text-ink-faint">· {new Date(p.receivedAt ?? p.createdAt).toLocaleDateString('sr-RS')}</span>
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold text-ink">{formatMoney(p.amount, p.currency)}</span>
                <Badge label={p.status} />
                {p.checkDetails && p.checkDetails.length > 0 && (
                  <a href={`/finansije/uplate/${p.id}`} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
                    specifikacija →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// `flat` (2.9.2026, na zahtev vlasnika: "leva i desna strana vizuelno da budu iste, ovako desno
// imamo zaokružene sektore a levo ne"). Ove četiri liste su ostale sa okvirom po redu kad su
// Aranžman/Putnici/Uplate dobili ravan prikaz — nije bila namerna razlika nego nedovršen posao,
// pa je desna kolona izgledala kao skup kartica a leva kao spisak. Pravilo §6h je isto za obe:
// okvir dobija samo ono na šta se klikne ili što je zaseban entitet, a ovo su čisti prikazi.
function CommunicationSummaryList({
  communications,
  directoryById,
  flat,
}: {
  communications: CommunicationEntry[];
  directoryById: Map<string, string>;
  flat?: boolean;
}) {
  if (communications.length === 0) return <p className="text-xs text-ink-faint">Nema zabeležene komunikacije sa ovim nalogodavcem.</p>;
  if (flat) {
    return (
      <ul className="divide-y divide-border">
        {communications.map((c) => (
          <li key={c.id} className="py-2">
            <div className="mb-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
              <Badge label={c.channel} />
              <Badge label={c.direction} />
              <ActorLabel
                name={c.sentBy ? (directoryById.get(c.sentBy) ?? (c.sentBy === 'SYSTEM_AUTO' ? 'automatski' : null)) : null}
                origin={c.sentBy === 'SYSTEM_AUTO' ? 'SYSTEM' : 'STAFF'}
                draftedByAi={c.draftedByAi}
              />
              <span>· {new Date(c.createdAt).toLocaleDateString('sr-RS')}</span>
            </div>
            <p className="text-[13px] text-ink">{c.summary}</p>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="space-y-2">
      {communications.map((c) => (
        <li key={c.id} className="rounded-lg border border-border bg-panel p-3">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
            <Badge label={c.channel} />
            <Badge label={c.direction} />
            <ActorLabel
              name={c.sentBy ? (directoryById.get(c.sentBy) ?? (c.sentBy === 'SYSTEM_AUTO' ? 'automatski' : null)) : null}
              origin={c.sentBy === 'SYSTEM_AUTO' ? 'SYSTEM' : 'STAFF'}
              draftedByAi={c.draftedByAi}
            />
            <span>· {new Date(c.createdAt).toLocaleDateString('sr-RS')}</span>
          </div>
          <p className="text-sm text-ink">{c.summary}</p>
        </li>
      ))}
    </ul>
  );
}

function NotesSummaryList({
  notes,
  directoryById,
  flat,
}: {
  notes: BookingNote[];
  directoryById: Map<string, string>;
  flat?: boolean;
}) {
  if (notes.length === 0) return <p className="text-xs text-ink-faint">Nema beleški uz ovu rezervaciju.</p>;
  if (flat) {
    return (
      <ul className="divide-y divide-border">
        {notes.map((n) => (
          // IZUZETAK od ravnog prikaza: beleška predstavnika sa terena zadržava svoju boju
          // (M5 spec §4.6 — mora biti izdvojeno vidljiva, to je vlasnikov raniji zahtev i
          // SEMANTIČKA razlika, ne ukras). Ali je okvir zamenjen levom trakom: signal ostaje,
          // a red se i dalje uklapa u ritam ostatka spiska umesto da bude kartica u njemu.
          <li
            key={n.id}
            className={`py-2 ${n.origin === 'FIELD_REP' ? '-mx-2 border-l-2 border-warn bg-warn-bg px-2' : ''}`}
          >
            <div className="mb-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
              <span className="font-medium text-ink">{directoryById.get(n.createdBy) ?? n.createdBy}</span>
              {n.origin === 'FIELD_REP' && <span className="rounded bg-warn-bg px-1.5 py-0.5 font-medium text-warn">sa terena</span>}
              <span>· {new Date(n.createdAt).toLocaleDateString('sr-RS')}</span>
            </div>
            <p className="text-[13px] text-ink">{n.body}</p>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="space-y-2">
      {notes.map((n) => (
        <li key={n.id} className={`rounded-lg border p-3 ${n.origin === 'FIELD_REP' ? 'border-warn/40 bg-warn-bg' : 'border-border bg-panel'}`}>
          <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
            <span className="font-medium text-ink">{directoryById.get(n.createdBy) ?? n.createdBy}</span>
            {n.origin === 'FIELD_REP' && <span className="rounded bg-warn-bg px-1.5 py-0.5 font-medium text-warn">sa terena</span>}
            <span>· {new Date(n.createdAt).toLocaleDateString('sr-RS')}</span>
          </div>
          <p className="text-sm text-ink">{n.body}</p>
        </li>
      ))}
    </ul>
  );
}

function TicketsSummaryList({ tickets, flat }: { tickets: Ticket[]; flat?: boolean }) {
  if (tickets.length === 0) return <p className="text-xs text-ink-faint">Nema nijedne reklamacije ni tiketa vezanog za ovu rezervaciju.</p>;
  if (flat) {
    return (
      <ul className="divide-y divide-border">
        {tickets.map((t) => (
          <li key={t.id} className="py-2">
            <div className="mb-0.5 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-mono text-ink">{t.ticketNumber}</span>
              <Badge label={t.status} />
              <Badge label={t.priority} />
            </div>
            <span className="text-[13px] text-ink">{t.subject}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="space-y-2">
      {tickets.map((t) => (
        <li key={t.id} className="rounded-lg border border-border bg-panel p-3">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-mono text-ink">{t.ticketNumber}</span>
            <Badge label={t.status} />
            <Badge label={t.priority} />
          </div>
          <span className="text-sm text-ink">{t.subject}</span>
        </li>
      ))}
    </ul>
  );
}

function RepsSummaryList({
  items,
  checkIns,
  directoryById,
  guides,
  canViewCheckIns,
  flat,
}: {
  items: BookingItem[];
  checkIns: RepCheckIn[];
  directoryById: Map<string, string>;
  guides: DirectoryUser[];
  canViewCheckIns: boolean;
  flat?: boolean;
}) {
  const guidesById = new Map(guides.map((g) => [g.id, g]));
  const active = items.filter((i) => i.itemStatus !== 'CANCELLED');
  if (active.length === 0) return <p className="text-xs text-ink-faint">Nema aktivnih stavki.</p>;
  if (flat) {
    return (
      <div className="divide-y divide-border">
        {active.map((item) => {
          const itemCheckIns = canViewCheckIns ? checkIns.filter((c) => c.bookingItemId === item.id) : [];
          const guide = item.assignedGuideId ? guidesById.get(item.assignedGuideId) : undefined;
          // Država i ovde punim nazivom uz oznaku (§6h) — do sada je ovaj red pokazivao sirovu
          // šifru, pa je ista destinacija izgledala drugačije nego u Aranžmanu iznad.
          const destination = [item.product?.destinationCity, item.product?.destinationArea, formatCountry(item.product?.destinationCountry)].filter(Boolean).join(', ');
          return (
            <div key={item.id} className="py-2 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink">{item.product?.name ?? `stavka ${item.id.slice(0, 8)}…`}</span>
                <span className="text-[11px] text-ink-faint">
                  {item.assignedGuideId ? (guide?.fullName ?? directoryById.get(item.assignedGuideId) ?? 'predstavnik dodeljen') : 'bez predstavnika'}
                  {canViewCheckIns && ` · prijave sa terena: ${itemCheckIns.length}/${item.guests?.length ?? 0}`}
                </span>
              </div>
              {item.assignedGuideId && (guide?.phone || guide?.email || destination) && (
                <div className="mt-0.5 text-[11px] text-ink-faint">{[guide?.phone, guide?.email, destination].filter(Boolean).join(' · ')}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {active.map((item) => {
        const itemCheckIns = canViewCheckIns ? checkIns.filter((c) => c.bookingItemId === item.id) : [];
        const guide = item.assignedGuideId ? guidesById.get(item.assignedGuideId) : undefined;
        const destination = [item.product?.destinationCity, item.product?.destinationArea, item.product?.destinationCountry].filter(Boolean).join(', ');
        return (
          <div key={item.id} className="rounded-lg border border-border bg-panel px-4 py-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink">{item.product?.name ?? `stavka ${item.id.slice(0, 8)}…`}</span>
              <span className="text-xs text-ink-faint">
                {item.assignedGuideId ? (guide?.fullName ?? directoryById.get(item.assignedGuideId) ?? 'predstavnik dodeljen') : 'bez predstavnika'}
                {canViewCheckIns && ` · prijave sa terena: ${itemCheckIns.length}/${item.guests?.length ?? 0}`}
              </span>
            </div>
            {item.assignedGuideId && (guide?.phone || guide?.email || destination) && (
              <div className="mt-1 text-[11px] text-ink-faint">
                {[guide?.phone, guide?.email, destination].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
