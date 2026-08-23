import Link from 'next/link';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import { PRODUCT_ICONS } from '@/lib/search-product-types';
import { MOCK_BOOKINGS, buildMockTimeline, type Traveler } from '../mock-data';
import FullRecordTimelineButton from './FullRecordTimelineButton';

// "Pun zapis" (23.8.2026, na zahtev vlasnika: "Jos treba da osmislimo celu formu koja ce se
// otvarati klikom na broj rezervacije... dajte neki predlog" — predlog dat u razgovoru, potvrđen
// istog dana: "Da gradi po predlogu, s tim sto cemo sigurno imati izmene i dorade"). Otvara se
// preko `openTab` u nov app-tab (dizajn dok. §5b: "dupli klik/dugme 'Otvori' uvek otvara nov
// tab") — sa liste (klik na broj) ili iz sažetka u desnom panelu (dugme "Otvori pun zapis").
// I DALJE MOCK — čita direktno iz `MOCK_BOOKINGS` po broju rezervacije (lista nema stvarne DB
// ID-jeve), isto ograničenje kao ostatak ove faze (v1.42-v1.47).
export default function BookingFullRecordPage({ params }: { params: { bookingNumber: string } }) {
  const booking = MOCK_BOOKINGS.find((b) => b.bookingNumber === params.bookingNumber);

  if (!booking) {
    return (
      <div className="p-6">
        <RegisterTab label={params.bookingNumber} />
        <p className="rounded bg-danger-bg p-3 text-sm text-danger">Rezervacija "{params.bookingNumber}" nije pronađena (mock lista).</p>
        <Link href="/rezervacije/lista" className="mt-3 inline-block text-xs text-accent hover:underline">
          ← nazad na listu
        </Link>
      </div>
    );
  }

  const b = booking;
  const money = (amount: number) => `${(amount / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} ${b.currency}`;
  const owed = b.totalPrice - b.paidAmount;
  const productIcon = PRODUCT_ICONS.find((p) => p.types.includes(b.productType));

  return (
    <div className="p-6">
      <RegisterTab label={b.bookingNumber} />
      <p className="mb-4 flex items-center gap-1.5 text-xs text-warn">
        <Icon name="warning" /> MOCK prikaz — izmišljen zapis, ne dolazi iz baze.
      </p>

      {/* Vrh — broj, status, tip aranžmana, brze akcije (dizajn dok. §5b predlog, 23.8.2026). */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <span title={productIcon?.label} className="flex h-7 w-7 items-center justify-center rounded bg-panel2 text-accent">
            <Icon name={productIcon?.icon ?? 'question'} />
          </span>
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> {b.bookingNumber}
          </h1>
          <Badge label={b.status} />
          {b.urgent && (
            <span className="flex items-center gap-1 rounded bg-danger-bg px-2 py-0.5 text-[11px] font-medium text-danger">
              <Icon name="bell" /> {b.urgent.reason}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <FullRecordTimelineButton entries={buildMockTimeline(b)} />
          <button disabled title="Izmena rezervacije — nije još povezano (mock lista)" className="flex h-[28px] items-center gap-1.5 rounded border border-ink-faint px-2 text-xs text-ink-faint opacity-40">
            <Icon name="edit" /> Izmeni
          </button>
          <button disabled title="Otkazivanje — nije još povezano (mock lista)" className="flex h-[28px] items-center gap-1.5 rounded border border-ink-faint px-2 text-xs text-ink-faint opacity-40">
            <Icon name="close" /> Otkaži
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Nosilac / destinacija / smeštaj */}
        <Section title="Nosilac i smeštaj" icon="location">
          <Row label="Nosilac rezervacije" value={b.buyerName} />
          <Row label="Tip kupca" value={b.buyerType === 'PRAVNO_LICE' ? 'Pravno lice' : 'Fizičko lice'} />
          <Row label="Destinacija" value={`${b.destinationCity}, ${b.country}`} />
          <Row label="Hotel/objekat" value={b.hotelName} />
          <Row label="Tip smeštaja" value={b.accommodationType} />
          <Row label="Dolazak" value={new Date(b.stayFrom).toLocaleDateString('sr-RS')} />
          <Row label="Odlazak" value={new Date(b.stayTo).toLocaleDateString('sr-RS')} />
          <Row label="Kanal prodaje" value={b.channel} />
          <Row label="Kreirano" value={new Date(b.createdAt).toLocaleDateString('sr-RS')} />
        </Section>

        {/* Putnici */}
        <Section title={`Putnici (${b.travelers.length})`} icon="account">
          <ul className="flex flex-col gap-1.5">
            {b.travelers.map((t) => (
              <li key={t.name} className="flex items-center justify-between gap-2 rounded bg-panel2 px-2 py-1.5 text-xs">
                <span className="text-ink">{t.name}</span>
                <span className="text-ink-faint">{travelerAgeLabel(t)}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Finansije */}
        <Section title="Finansije" icon="credit-card">
          <Row label="Ukupno" value={money(b.totalPrice)} strong />
          <Row label="Uplaćeno" value={money(b.paidAmount)} />
          <Row label="Dug" value={money(owed)} tone={owed > 0 ? 'danger' : undefined} />
          <Row label="Status uplate" value={b.paymentStatus} />
          <p className="mt-2 text-[11px] italic text-ink-faint">
            Prikaz na nivou rezervacije — raščlana po stavkama (BookingItem) dolazi kad lista bude povezana na pravu bazu.
          </p>
        </Section>

        {/* Dobavljač / kanal / operativno */}
        <Section title="Operativno" icon="organization">
          <Row label="Dobavljač" value={b.supplierName} />
          <Row label="Partner (subagent/firma)" value={b.partnerName ?? '—'} />
          <Row label="Poslovnica" value={b.branch} />
          <Row label="Zadužen" value={b.assignedUser} />
        </Section>
      </div>
    </div>
  );
}

function travelerAgeLabel(t: Traveler): string {
  const label = t.ageCategory === 'ADULT' ? 'odrasla osoba' : t.ageCategory === 'CHILD' ? 'dete' : 'beba';
  if (t.ageCategory === 'ADULT') return t.birthYear ? `${label}, rođ. ${t.birthYear}.` : label;
  return `${label}, rođ. ${t.birthYear}.`;
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon name={icon} className="text-accent" /> {title}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'danger' }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-ink-faint">{label}</span>
      <span className={`text-right ${strong ? 'font-semibold text-ink' : tone === 'danger' ? 'font-medium text-danger' : 'text-ink-dim'}`}>{value}</span>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  const tone = ['CONFIRMED', 'COMPLETED'].includes(label) ? 'text-ok bg-ok-bg' : label === 'CANCELLED' ? 'text-danger bg-danger-bg' : 'text-ink-faint bg-panel2';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}
