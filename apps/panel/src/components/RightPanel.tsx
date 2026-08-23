'use client';

import { useState } from 'react';
import Icon from './Icon';
import { useSelection } from './SelectionContext';
import { useRowSummary } from './RowSummaryContext';
import { useTabs } from './TabsContext';
import { createQuoteFromSelection } from '@/app/(app)/rezervacije/pretraga/actions';

// Dizajn dok. §5b — desni panel, "izdvajanje": sažetak reda kad je centar lista i korisnik
// klikne red bez ulaska u pun zapis, ili "Povezano" traka kad centar prikazuje pun zapis
// (npr. gost → njegove rezervacije/fakture/tiketi). Pojavljuje se prema potrebi (dugme u
// TopBar-u, ili automatski čim M5 selekcija dobije prvu stavku — Shell.tsx). NE nosi AI
// razgovor — chat je od 19.8.2026 trajan deo centralnog panela (AiChatBox.tsx, Shell.tsx),
// ovo je odvojena, ranije definisana svrha.
//
// Prvi stvaran sadržaj (21.8.2026, na zahtev vlasnika): M5 spec §3.0e.3 selekcija stavki iz
// pretrage. "Sažetak reda" (23.8.2026, na zahtev vlasnika: "Kada otvorimo desni panel i
// kliknemo na neki red iz liste rezervacija u desnom panelu treba da se prikazu sve
// najvaznije informacije") dobio izvor — `RowSummaryContext.tsx`, poseban od `SelectionContext`
// (različita svrha/oblik). Selekcija ima prioritet nad sažetkom reda ako je oboje aktivno
// (redak slučaj — različiti ekrani), inače sažetak reda, inače prazno stanje.
export default function RightPanel({ onClose }: { onClose: () => void }) {
  const { items, removeItem, clear } = useSelection();
  const { summary, clearSummary } = useRowSummary();
  const { navigateInTab, openTab } = useTabs();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currencies = Array.from(new Set(items.map((i) => i.finalPriceCurrency)));
  const totalsByCurrency = currencies.map((c) => ({
    currency: c,
    total: items.filter((i) => i.finalPriceCurrency === c).reduce((sum, i) => sum + i.finalPrice, 0),
  }));

  async function handleCreateQuote() {
    setPending(true);
    setError(null);
    const res = await createQuoteFromSelection(items);
    setPending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    clear();
    onClose();
    if (res.quoteId) navigateInTab(`/rezervacije/ponude/${res.quoteId}`, 'Ponuda');
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-panel-2">
      <div className="flex h-[43px] flex-shrink-0 items-center justify-between border-b border-border px-2 text-xs font-medium text-ink-faint">
        <span>{items.length > 0 ? `Selekcija (${items.length})` : summary ? 'Sažetak reda' : 'Izdvajanje'}</span>
        <button
          onClick={() => {
            if (items.length === 0) clearSummary();
            onClose();
          }}
          title="Zatvori panel"
          className="flex h-[29px] w-[29px] items-center justify-center rounded hover:bg-panel hover:text-ink"
        >
          <Icon name="close" />
        </button>
      </div>

      {items.length === 0 && summary && (
        <BookingSummary summary={summary} onOpenFullRecord={() => openTab(`/rezervacije/lista/${summary.bookingNumber}`, summary.bookingNumber)} />
      )}

      {items.length === 0 && !summary && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-xs text-ink-faint">
          <Icon name="inspect" className="text-2xl" />
          <p>Klikni na red liste (bez otvaranja zapisa) da vidiš sažetak ovde, ili otvori pun zapis za "Povezano" prikaz.</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-2">
            <div className="flex flex-col gap-2">
              {items.map((i) => (
                <SelectionRow key={i.key} item={i} onRemove={() => removeItem(i.key)} />
              ))}
            </div>
          </div>

          <div className="flex-shrink-0 border-t border-border p-2">
            {currencies.length > 1 && (
              <p className="mb-2 rounded bg-warn-bg px-2 py-1 text-[11px] text-warn">
                Selekcija sadrži više valuta — zbir po valuti ispod, konverzija se rešava pri fakturisanju (M10).
              </p>
            )}
            <div className="mb-2 flex flex-col gap-0.5 text-xs text-ink-dim">
              {totalsByCurrency.map((t) => (
                <div key={t.currency} className="flex items-center justify-between">
                  <span>Zbir ({t.currency})</span>
                  <span className="font-mono font-semibold text-ink">
                    {(t.total / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} {t.currency}
                  </span>
                </div>
              ))}
            </div>
            {error && <p className="mb-2 text-[11px] text-danger">{error}</p>}
            <button
              onClick={handleCreateQuote}
              disabled={pending}
              className="w-full rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
            >
              {pending ? '…' : 'Napravi ponudu'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpiryBadge({ quoteExpiresAt }: { quoteExpiresAt: string }) {
  const minutesLeft = Math.round((new Date(quoteExpiresAt).getTime() - Date.now()) / 60000);
  const expired = minutesLeft <= 0;
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${expired ? 'bg-danger-bg text-danger' : 'bg-warn-bg text-warn'}`}>
      {expired ? 'istekla' : `ističe za ${minutesLeft} min`}
    </span>
  );
}

// "Odrasla osoba/dete/beba" oznaka (23.8.2026, na zahtev vlasnika: "Svuda Prikazati da li je
// osoba odrasla osoba, dete ili beba (navesti i godine rodjenja za decu i bebe, a za odrasle
// samo ukoliko je taj podatak unet)") — CHILD/BABY UVEK nose godinu rođenja (obavezno polje u
// mock/stvarnom modelu), ADULT je samo ako je uneta (opciono polje).
function travelerAgeLabel(t: import('./RowSummaryContext').Traveler): string {
  const label = t.ageCategory === 'ADULT' ? 'odrasla osoba' : t.ageCategory === 'CHILD' ? 'dete' : 'beba';
  if (t.ageCategory === 'ADULT') return t.birthYear ? `${label}, rođ. ${t.birthYear}.` : label;
  return `${label}, rođ. ${t.birthYear}.`;
}

// Dopuna (23.8.2026, na zahtev vlasnika) — "sve najvažnije informacije": putnici, tip
// smeštaja, koliko je uplaćeno, koliko je dug. Polja su opciona (`RowSummary` interfejs) jer
// izvor može biti mock red (nema ih sva) ili, kasnije, stvaran API odgovor.
function BookingSummary({ summary: s, onOpenFullRecord }: { summary: import('./RowSummaryContext').RowSummary; onOpenFullRecord: () => void }) {
  const money = (amount: number) => `${(amount / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} ${s.currency}`;
  return (
    <div className="flex-1 overflow-y-auto p-3 text-xs">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono font-semibold text-ink">{s.bookingNumber}</span>
        <span className="rounded bg-panel px-2 py-0.5 text-[11px] font-medium text-ink-dim">{s.status}</span>
      </div>
      <button
        onClick={onOpenFullRecord}
        className="mb-3 flex w-full items-center justify-center gap-1.5 rounded border border-accent px-2 py-1.5 text-[11px] font-semibold text-accent hover:bg-accent-soft"
      >
        <Icon name="link-external" /> Otvori pun zapis
      </button>
      <SummaryRow label="Nosilac rezervacije" value={s.buyerName} />
      {(s.country || s.destinationCity) && <SummaryRow label="Destinacija" value={[s.destinationCity, s.country].filter(Boolean).join(', ')} />}
      {s.hotelName && <SummaryRow label="Hotel/objekat" value={s.hotelName} />}
      {s.accommodationType && <SummaryRow label="Tip smeštaja" value={s.accommodationType} />}
      <SummaryRow label="Dolazak" value={new Date(s.stayFrom).toLocaleDateString('sr-RS')} />
      <SummaryRow label="Odlazak" value={new Date(s.stayTo).toLocaleDateString('sr-RS')} />
      {s.branch && <SummaryRow label="Poslovnica" value={s.branch} />}
      {s.assignedUser && <SummaryRow label="Zadužen" value={s.assignedUser} />}
      {s.travelers && s.travelers.length > 0 && (
        <div className="mt-2 mb-1">
          <div className="mb-1 text-ink-faint">Putnici ({s.travelers.length})</div>
          <ul className="flex flex-col gap-0.5">
            {s.travelers.map((t) => (
              <li key={t.name} className="flex items-center justify-between gap-2 text-ink-dim">
                <span>{t.name}</span>
                <span className="text-[10px] text-ink-faint">{travelerAgeLabel(t)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 flex flex-col gap-0.5 rounded-lg border border-border bg-panel p-2">
        <SummaryRow label="Ukupno" value={money(s.totalPrice)} strong />
        <SummaryRow label="Uplaćeno" value={s.paidAmount !== undefined ? money(s.paidAmount) : '—'} />
        <SummaryRow label="Dug" value={s.owedAmount !== undefined ? money(s.owedAmount) : '—'} tone={s.owedAmount ? 'danger' : undefined} />
        <SummaryRow label="Status uplate" value={s.paymentStatus} />
      </div>
    </div>
  );
}

function SummaryRow({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'danger' }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-ink-faint">{label}</span>
      <span className={`text-right ${strong ? 'font-semibold text-ink' : tone === 'danger' ? 'font-medium text-danger' : 'text-ink-dim'}`}>{value}</span>
    </div>
  );
}

function SelectionRow({ item, onRemove }: { item: import('./SelectionContext').SelectionItem; onRemove: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-2 text-xs">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{item.productName}</div>
          <div className="text-[11px] text-ink-faint">{item.productType}</div>
        </div>
        <button onClick={onRemove} title="Ukloni iz selekcije" className="flex-shrink-0 text-ink-faint hover:text-danger">
          <Icon name="close" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-semibold text-ink">
          {(item.finalPrice / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} {item.finalPriceCurrency}
        </span>
        {item.sourceType === 'API' && item.quoteExpiresAt && <ExpiryBadge quoteExpiresAt={item.quoteExpiresAt} />}
      </div>
    </div>
  );
}
