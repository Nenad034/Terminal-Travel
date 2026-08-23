'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import BookingTimelineModal, { type TimelineEntry } from '@/components/BookingTimelineModal';
import { PRODUCT_ICONS } from '@/lib/search-product-types';
import { buildMockTimeline, type MockBookingItem, type MockBookingRow, type Traveler } from '../mock-data';
import BookingItemsEditor from './BookingItemsEditor';

// "Izmeni" — nosilac klijentskog stanja za pun zapis (23.8.2026, na zahtev vlasnika: "za svako
// segment da se pojavi modul u kom ce se unositi rucno podaci novi ili menjatu stari i za sve to
// treba da postoji zapis u work flow"). Stavke (segmenti) i workflow log žive OVDE, u React
// state-u — mock lista nema pravu bazu, pa izmena traje samo dok je tab otvoren (osvežavanje
// stranice vraća na originalne mock vrednosti), isto ograničenje kao ostatak ove faze. Svaka
// sačuvana izmena stavke odmah dobija zapis u toku rezervacije (spojeno sa `buildMockTimeline`).
export default function BookingRecordClient({ booking }: { booking: MockBookingRow }) {
  const [items, setItems] = useState<MockBookingItem[]>(booking.items);
  const [extraLog, setExtraLog] = useState<TimelineEntry[]>([]);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const timeline = [...buildMockTimeline(booking), ...extraLog];

  function saveItem(id: string, patch: Partial<MockBookingItem>, changeSummary: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    setExtraLog((prev) => [
      ...prev,
      { timestamp: new Date().toISOString(), action: `booking.item_modified (${id})`, actorType: 'HUMAN', actorName: 'trenutno prijavljen agent — ' + changeSummary },
    ]);
  }

  function addItem(item: MockBookingItem) {
    setItems((prev) => [...prev, item]);
    setExtraLog((prev) => [
      ...prev,
      { timestamp: new Date().toISOString(), action: `booking.item_added (${item.id})`, actorType: 'HUMAN', actorName: 'trenutno prijavljen agent — dodata nova stavka' },
    ]);
  }

  const b = booking;
  const money = (amount: number) => `${(amount / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} ${b.currency}`;
  const owed = b.totalPrice - b.paidAmount;
  const productIcon = PRODUCT_ICONS.find((p) => p.types.includes(b.productType));

  return (
    <>
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
          <button
            onClick={() => setTimelineOpen(true)}
            title="Tok rezervacije — ceo workflow, ko je i kada radio promenu"
            className="flex h-[28px] items-center gap-1.5 rounded border border-ink-faint px-2 text-xs text-ink-faint hover:border-accent hover:text-accent"
          >
            <Icon name="three-bars" /> Tok rezervacije
          </button>
          <button disabled title="Otkazivanje — nije još povezano (mock lista)" className="flex h-[28px] items-center gap-1.5 rounded border border-ink-faint px-2 text-xs text-ink-faint opacity-40">
            <Icon name="close" /> Otkaži
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Nosilac / destinacija / smeštaj — istorijski snimak sa liste, ostaje nepromenjen
            izmenama stavki ispod (isti princip kao razlika Quote → Booking snapshot). */}
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
            Zbir iznad ostaje istorijski snimak sa liste — raščlana po stavkama (sa mogućnošću izmene) je u sekciji "Stavke (segmenti)" ispod.
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

      <div className="mt-4">
        <BookingItemsEditor items={items} onSaveItem={saveItem} onAddItem={addItem} />
      </div>

      {timelineOpen && <BookingTimelineModal mockEntries={timeline} onClose={() => setTimelineOpen(false)} />}
    </>
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
