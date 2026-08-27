'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Icon from './Icon';
import { useSelection } from './SelectionContext';
import { useRowSummary } from './RowSummaryContext';
import { useProductPreview } from './ProductPreviewContext';
import { useTabs } from './TabsContext';
import { createQuoteFromSelection } from '@/app/(app)/rezervacije/pretraga/actions';
import { usePanelCollection, PANEL_ITEM_DRAG_MIME, type PanelCollectionItem } from './PanelCollectionContext';
import AiChatBox from './AiChatBox';
import ProductPreviewCard from './ProductPreviewCard';
import ProductContactCard from './ProductContactCard';

// Dizajn dok. §5b — desni panel, "izdvajanje": sažetak reda kad je centar lista i korisnik
// klikne red bez ulaska u pun zapis, ili "Povezano" traka kad centar prikazuje pun zapis
// (npr. gost → njegove rezervacije/fakture/tiketi). Pojavljuje se prema potrebi (dugme u
// TopBar-u, ili automatski čim M5 selekcija dobije prvu stavku — Shell.tsx).
//
// AI chat (§6c.0, dopuna 25.8.2026, na zahtev vlasnika — napušta raniji plutajući prozor u uglu)
// je sad TRAJAN deo OVOG panela, naslagan ISPOD sadržaja iznad (ne tabovi, oba mogu biti
// vidljiva odjednom) — otvaranje/zatvaranje ovog panela sad kontroliše i pristup AI chat-u.
// `AiChatBox` ostaje montiran čak i kad je panel kolabovan na širinu 0 (Shell.tsx, isti obrazac
// kao bočna traka) — istorija razgovora se time ne gubi.
//
// Prvi stvaran sadržaj (21.8.2026, na zahtev vlasnika): M5 spec §3.0e.3 selekcija stavki iz
// pretrage. "Sažetak reda" (23.8.2026, na zahtev vlasnika: "Kada otvorimo desni panel i
// kliknemo na neki red iz liste rezervacija u desnom panelu treba da se prikazu sve
// najvaznije informacije") dobio izvor — `RowSummaryContext.tsx`, poseban od `SelectionContext`
// (različita svrha/oblik). Selekcija ima prioritet nad sažetkom reda ako je oboje aktivno
// (redak slučaj — različiti ekrani), inače sažetak reda, inače prazno stanje.
//
// M17 spec v2.10 — panel sad grana prikaz po TRENUTNOM MODULU (`moduleId`, `NAV_GROUP` granica
// iz nav.ts, prosleđuje Shell.tsx). `moduleId === 'prodaja'` (M5: pretraga/kalendar/lista
// rezervacija) zadržava GORNJI, nepromenjen tok (selekcija za ponudu/sažetak reda). Svaki drugi
// modul dobija generičku "policu podsetnika" (`PanelCollectionContext`) punjenu prevlačenjem —
// nema poslovnu akciju u ovom prolazu, samo prikaz+link+brisanje (pojedinačno/masovno/sve).
const PRODAJA_MODULE_ID = 'prodaja';

// Ruta punog prikaza proizvoda (`/katalog/[id]/pregled`, ProductGalleryPage) — desni panel
// ovde prikazuje kontakt+"aktivne rezervacije" (`ProductContactCard`) NEZAVISNO od `moduleId`
// (M17 spec "Desni panel — brzi pregled proizvoda", Faza B). `katalog` pripada grupi
// `katalog-nabavka` (nav.ts), RAZLIČITOJ od `prodaja` gde je pregled pokrenut — provera mora
// biti po RUTI, ne po modulu, da radi bez obzira gde je ta ruta grupisana u levoj traci.
const PRODUCT_PREGLED_RE = /^\/katalog\/([^/]+)\/pregled$/;

function clampPercent(value: number): number {
  return Math.min(80, Math.max(15, value));
}

export default function RightPanel({
  moduleId,
  moduleLabel,
  onClose,
  displayMode,
  onToggleDisplayMode,
}: {
  moduleId: string;
  moduleLabel: string;
  onClose: () => void;
  /** §6c.0 — `push` (podrazumevano, sužava centralni sadržaj) naspram `overlay` (plutajući sloj
   * preko sadržaja, širina se ne menja) — čuva se po korisniku, Shell.tsx (`UserPreference`
   * ključ `right_panel_display_mode`). */
  displayMode: 'push' | 'overlay';
  onToggleDisplayMode: () => void;
}) {
  const { items, removeItem, clear } = useSelection();
  const { summary, clearSummary } = useRowSummary();
  const { items: previewItems } = useProductPreview();
  const { navigateInTab, openTab } = useTabs();
  const pathname = usePathname();
  const productPregledMatch = pathname.match(PRODUCT_PREGLED_RE);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { itemsByModule, addItem: addCollectedItem, removeItem: removeCollectedItem, removeItems: removeCollectedItems, clearModule } =
    usePanelCollection();
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  // Sklapanje jednog od dva naslagana dela kad nije potreban (dopuna 25.8.2026, na zahtev
  // vlasnika: "kada se nalaze u desnom panelu i ai agent i neki sadrzaj omoguciti uklanjanje
  // jednog od dva dela ako nije potreban") — SAMO vizuelno sklapanje (visina 0), `AiChatBox`
  // ostaje montiran čak i kad je sklopljen (isti princip kao kolabovan ceo panel, Shell.tsx) —
  // istorija razgovora se ne gubi. Sklapanje gornjeg dela pušta AI chat da zauzme CEO preostali
  // prostor umesto fiksnih ~40% (`topCollapsed` ispod menja AI sekciju sa `h-[40%]` na `flex-1`).
  const [topCollapsed, setTopCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  // Ručno podešavanje visine linije koja deli AI chat od sadržaja iznad (dopuna 25.8.2026, na
  // zahtev vlasnika: "omogucite rucno podesavanje visine linije koja deli ai agenta od sadrzaja
  // u desnom panelu") — procenat visine PANELA (ne piksela, da se ponašanje ne slomi kad se
  // panel ručno suzi/proširi preko `ResizablePane`, Shell.tsx). Pamti se po korisniku preko
  // `localStorage` (isti privremen obrazac kao širina bočne trake/panela dok pravi
  // `UserPreference` ne pokrije i ovo, M1 §3.9).
  const containerRef = useRef<HTMLDivElement>(null);
  const [chatHeightPercent, setChatHeightPercent] = useState(40);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('tt-panel-right-chat-height');
      if (raw) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) setChatHeightPercent(clampPercent(parsed));
      }
    } catch {
      // localStorage nedostupan — ostaje podrazumevanih 40%
    }
  }, []);

  function handleDividerPointerDown() {
    const el = containerRef.current;
    if (!el) return;
    function onMove(ev: PointerEvent) {
      const rect = el!.getBoundingClientRect();
      setChatHeightPercent(clampPercent(((rect.bottom - ev.clientY) / rect.height) * 100));
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setChatHeightPercent((p) => {
        try {
          localStorage.setItem('tt-panel-right-chat-height', String(p));
        } catch {
          // ponašanje i dalje radi za ovu sesiju bez trajnog čuvanja
        }
        return p;
      });
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  const isProdaja = moduleId === PRODAJA_MODULE_ID;
  const collectedItems = itemsByModule[moduleId] ?? [];

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

  function toggleSelected(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const raw = e.dataTransfer.getData(PANEL_ITEM_DRAG_MIME);
    if (!raw) return;
    try {
      const item = JSON.parse(raw) as PanelCollectionItem;
      addCollectedItem(item);
    } catch {
      // Nevalidan/tuđ drag payload — tiho ignorisano, ne blokira interakciju.
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col overflow-hidden bg-panel-2"
      onDragOver={!isProdaja ? (e) => { e.preventDefault(); setDragOver(true); } : undefined}
      onDragLeave={!isProdaja ? () => setDragOver(false) : undefined}
      onDrop={!isProdaja ? handleDrop : undefined}
    >
      <div className="flex h-[43px] flex-shrink-0 items-center justify-between border-b border-border px-2 text-xs font-medium text-ink-faint">
        <span>
          {isProdaja
            ? items.length > 0
              ? `Selekcija (${items.length})`
              : summary
                ? 'Sažetak reda'
                : 'Izdvajanje'
            : collectedItems.length > 0
              ? `Podsetnik — ${moduleLabel} (${collectedItems.length})`
              : `Podsetnik — ${moduleLabel}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTopCollapsed((v) => !v)}
            title={topCollapsed ? 'Prikaži ovaj deo' : 'Sklopi ovaj deo (AI chat zauzima ostatak prostora)'}
            className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
          >
            <Icon name={topCollapsed ? 'chevron-down' : 'chevron-up'} />
          </button>
          <button
            onClick={onToggleDisplayMode}
            title={displayMode === 'push' ? 'Prelazi preko sadržaja (bez sužavanja)' : 'Sužava sadržaj (bez preklapanja)'}
            className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
          >
            <Icon name={displayMode === 'push' ? 'layout-panel-right' : 'layers'} />
          </button>
          <button
            onClick={() => {
              if (isProdaja && items.length === 0) clearSummary();
              onClose();
            }}
            title="Zatvori panel"
            className="flex h-[29px] w-[29px] items-center justify-center rounded hover:bg-panel hover:text-ink"
          >
            <Icon name="close" />
          </button>
        </div>
      </div>

      <div className={topCollapsed ? 'h-0 overflow-hidden' : 'flex min-h-0 flex-1 flex-col overflow-hidden'}>
      {/* Prioritet unutar "prodaja" modula (Faza B, 26.8.2026): selekcija (ponuda) > brzi
          pregled proizvoda (ProductPreviewContext istorija, klik na naziv u pretrazi) > sažetak
          reda > prazno stanje. Raniji mock (isti dan, ranije) je zamenjen stvarnim podacima —
          `ProductPreviewCard` sad sam učitava preko `/api/catalog/products/:id/preview`. */}
      {isProdaja && items.length === 0 && previewItems.length > 0 && <ProductPreviewCard />}

      {isProdaja && items.length === 0 && previewItems.length === 0 && summary?.kind === 'booking' && (
        <BookingSummary summary={summary} onOpenFullRecord={() => openTab(`/rezervacije/lista/${summary.bookingNumber}`, summary.bookingNumber)} />
      )}

      {isProdaja && items.length === 0 && previewItems.length === 0 && summary?.kind === 'calendar-day' && (
        <CalendarDaySummaryCard summary={summary} />
      )}

      {isProdaja && items.length === 0 && previewItems.length === 0 && !summary && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-xs text-ink-faint">
          <Icon name="inspect" className="text-2xl" />
          <p>Klikni na red liste (bez otvaranja zapisa) da vidiš sažetak ovde, ili otvori pun zapis za "Povezano" prikaz.</p>
        </div>
      )}

      {isProdaja && items.length > 0 && (
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

      {/* Kontakt + "aktivne rezervacije" link za proizvod čiji je pun opis otvoren u centralnom
          panelu (`/katalog/:id/pregled`, Faza B) — PRE generičkog "podsetnik" prikaza ispod za
          isti razlog kao PRODUCT_PREGLED_RE komentar iznad (druga NAV grupa od "prodaja"). */}
      {productPregledMatch && <ProductContactCard productId={productPregledMatch[1]} />}

      {!isProdaja && !productPregledMatch && collectedItems.length === 0 && (
        <div
          className={`flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-xs ${
            dragOver ? 'bg-accent-soft text-ink' : 'text-ink-faint'
          }`}
        >
          <Icon name="gripper" className="text-2xl" />
          <p>Prevuci ovde nešto iz centralnog panela da ga zadržiš kao podsetnik.</p>
        </div>
      )}

      {!isProdaja && !productPregledMatch && collectedItems.length > 0 && (
        <div className={`flex flex-1 flex-col overflow-hidden ${dragOver ? 'bg-accent-soft' : ''}`}>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="flex flex-col gap-2">
              {collectedItems.map((item) => (
                <CollectedItemRow
                  key={item.key}
                  item={item}
                  selected={selectedKeys.has(item.key)}
                  onToggleSelected={() => toggleSelected(item.key)}
                  onOpen={item.href ? () => openTab(item.href!, item.label) : undefined}
                  onRemove={() => removeCollectedItem(moduleId, item.key)}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2 border-t border-border p-2">
            {selectedKeys.size > 0 && (
              <button
                onClick={() => {
                  removeCollectedItems(moduleId, Array.from(selectedKeys));
                  setSelectedKeys(new Set());
                }}
                className="flex-1 rounded bg-panel px-3 py-1.5 text-xs font-medium text-ink hover:bg-border"
              >
                Obriši izabrano ({selectedKeys.size})
              </button>
            )}
            <button
              onClick={() => {
                clearModule(moduleId);
                setSelectedKeys(new Set());
              }}
              className="flex-1 rounded px-3 py-1.5 text-xs font-medium text-ink-faint hover:text-danger"
            >
              Obriši sve
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Linija koja deli AI chat od sadržaja iznad — ručno prevlačiva (dopuna 25.8.2026, na
          zahtev vlasnika: "omogucite rucno podesavanje visine linije koja deli ai agenta od
          sadrzaja"), isti `cursor-row-resize` obrazac kao `ResizablePane` (horizontalne granice).
          Prikazana SAMO kad ima šta stvarno da se deli (oba dela otvorena) — prevlačenje kad je
          jedan deo sklopljen nema šta da menja. */}
      {!topCollapsed && !chatCollapsed && (
        <div
          onPointerDown={handleDividerPointerDown}
          title="Prevuci za promenu visine AI chat-a"
          className="h-1.5 flex-shrink-0 cursor-row-resize border-t border-transparent hover:border-accent"
        />
      )}

      {/* §6c.0 — naslagano ISPOD sadržaja iznad, podrazumevano 40% visine panela (ručno
          podesivo, `chatHeightPercent` iznad) — ILI CEO preostali prostor kad je gornji deo
          sklopljen (`topCollapsed`). `AiChatBox` je UVEK montiran (isti roditelj, samo se
          sekcija/panel kolabuje) — istorija se ne gubi. */}
      <div
        className={`flex flex-shrink-0 flex-col overflow-hidden ${topCollapsed || chatCollapsed ? 'border-t border-border' : ''} bg-panel ${
          chatCollapsed ? 'h-9' : topCollapsed ? 'flex-1' : ''
        }`}
        style={!chatCollapsed && !topCollapsed ? { height: `${chatHeightPercent}%` } : undefined}
      >
        <div className="flex h-9 flex-shrink-0 items-center justify-between border-b border-border px-2 text-xs font-medium text-ink-faint">
          <span className="flex items-center gap-1.5">
            <Icon name="sparkle" className="text-accent" /> AI asistent
          </span>
          {/* Dugme "Fokus" (dopuna 25.8.2026, na zahtev vlasnika: "dugme za prosirivanje ai
              agenta stavite u gornji desno cosak ai modula") — premešteno ovamo iz AiChatBox.tsx
              reda za unos (gde je bilo pre ove dopune). */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => openTab('/ai-asistent', 'AI asistent')}
              title="Otvori u punom tabu (Fokus režim)"
              className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel-2 hover:text-ink"
            >
              <Icon name="screen-full" />
            </button>
            <button
              onClick={() => setChatCollapsed((v) => !v)}
              title={chatCollapsed ? 'Prikaži AI chat' : 'Sklopi AI chat (ostatak zauzima ostali sadržaj)'}
              className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel-2 hover:text-ink"
            >
              <Icon name={chatCollapsed ? 'chevron-up' : 'chevron-down'} />
            </button>
          </div>
        </div>
        <div className={chatCollapsed ? 'hidden' : 'min-h-0 flex-1 overflow-hidden'}>
          <AiChatBox />
        </div>
      </div>
    </div>
  );
}

function CollectedItemRow({
  item,
  selected,
  onToggleSelected,
  onOpen,
  onRemove,
}: {
  item: PanelCollectionItem;
  selected: boolean;
  onToggleSelected: () => void;
  onOpen?: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-panel p-2 text-xs">
      <input type="checkbox" checked={selected} onChange={onToggleSelected} className="mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        {onOpen ? (
          <button onClick={onOpen} className="truncate text-left font-medium text-ink hover:text-accent">
            {item.label}
          </button>
        ) : (
          <div className="truncate font-medium text-ink">{item.label}</div>
        )}
        {item.subtitle && <div className="truncate text-[11px] text-ink-faint">{item.subtitle}</div>}
      </div>
      <button onClick={onRemove} title="Ukloni" className="flex-shrink-0 text-ink-faint hover:text-danger">
        <Icon name="close" />
      </button>
    </div>
  );
}

function ExpiryBadge({ quoteExpiresAt }: { quoteExpiresAt: string }) {
  const minutesLeft = Math.round((new Date(quoteExpiresAt).getTime() - Date.now()) / 60000);
  const expired = minutesLeft <= 0;
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${expired ? 'bg-danger-bg text-danger' : 'bg-warn-bg text-warn'}`}>
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
function BookingSummary({ summary: s, onOpenFullRecord }: { summary: import('./RowSummaryContext').BookingRowSummary; onOpenFullRecord: () => void }) {
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
      {/* BAG (25.8.2026, prijavio vlasnik uživo, uz snimak ekrana — red bez stavki sa
          datumom, npr. TT-M6-E2E-...-mjlipe8avah, prikazivao "Invalid Date") — `s.stayFrom`/
          `s.stayTo` su prazan string kad rezervacija nema stavki sa datumom
          (`RealBookingsTable.tsx` postavlja `null` → `''` kad nema stavki), a `new Date('')`
          je UVEK "Invalid Date", ne prazan/nedostajući datum. Redovi se sad sakriju umesto da
          prikažu netačnu vrednost — isti obrazac kao ostala opciona polja iznad (hotelName,
          accommodationType...). */}
      {s.stayFrom && <SummaryRow label="Dolazak" value={new Date(s.stayFrom).toLocaleDateString('sr-RS')} />}
      {s.stayTo && <SummaryRow label="Odlazak" value={new Date(s.stayTo).toLocaleDateString('sr-RS')} />}
      {s.branch && <SummaryRow label="Poslovnica" value={s.branch} />}
      {s.assignedUser && <SummaryRow label="Zadužen" value={s.assignedUser} />}
      {s.travelers && s.travelers.length > 0 && (
        <div className="mt-2 mb-1">
          <div className="mb-1 text-ink-faint">Putnici ({s.travelers.length})</div>
          <ul className="flex flex-col gap-0.5">
            {s.travelers.map((t) => (
              <li key={t.name} className="flex items-center justify-between gap-2 text-ink-dim">
                <span>{t.name}</span>
                <span className="text-[11px] text-ink-faint">{travelerAgeLabel(t)}</span>
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

// Sumarni izveštaj za jedan dan u kalendaru (M17 spec dopuna, 27.8.2026, na zahtev vlasnika:
// "kada kliknemo na stavku kalendara u desnom panelu treba da se pojavi sumarni izveštaj
// koliko rezervacija, statusi, koje destinacije, koliko osoba, koliko soba, da li ima i koliko
// rezervacija sa alertima"). Agregat se računa u `rezervacije/kalendar/build-day-summary.ts`
// (Dan prikaz, `RegisterDaySummary.tsx`) — ovaj komponent samo prikazuje već gotov objekat.
// Dve autorske dopune ("možete i vi dodati nešto"): vrednost po valuti, raščlanjenje po tipu
// proizvoda.
function CalendarDaySummaryCard({ summary: s }: { summary: import('./RowSummaryContext').CalendarDaySummary }) {
  const dateLabel = new Date(`${s.date}T00:00:00`).toLocaleDateString('sr-RS', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hasAlerts = s.supplierPendingCount > 0 || s.unpaidCount > 0;
  return (
    <div className="flex-1 overflow-y-auto p-3 text-xs">
      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-wide text-ink-faint">Sažetak dana</div>
        <div className="font-mono font-semibold capitalize text-ink">{dateLabel}</div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <StatTile label="Rezervacija" value={s.bookingCount} />
        <StatTile label="Stavki" value={s.itemCount} />
        <StatTile label="Osoba" value={s.totalGuests} />
        <StatTile label="Soba" value={s.totalRooms} />
      </div>

      {hasAlerts && (
        <div className="mb-3 flex flex-col gap-1 rounded-lg border border-danger bg-danger-bg p-2">
          <div className="flex items-center gap-1.5 font-medium text-danger">
            <Icon name="warning" /> Upozorenja
          </div>
          {s.supplierPendingCount > 0 && <SummaryRow label="Čeka potvrdu dobavljača" value={String(s.supplierPendingCount)} tone="danger" />}
          {s.unpaidCount > 0 && <SummaryRow label="Nije naplaćeno" value={String(s.unpaidCount)} tone="danger" />}
        </div>
      )}

      {Object.keys(s.statusCounts).length > 0 && (
        <BreakdownSection title="Po statusu" counts={s.statusCounts} />
      )}
      {Object.keys(s.destinationCounts).length > 0 && (
        <BreakdownSection title="Po destinaciji" counts={s.destinationCounts} />
      )}
      {Object.keys(s.productTypeCounts).length > 0 && (
        <BreakdownSection title="Po tipu proizvoda" counts={s.productTypeCounts} />
      )}
      {Object.keys(s.valueByCurrency).length > 0 && (
        <div className="mt-2 mb-1">
          <div className="mb-1 text-ink-faint">Ukupna vrednost</div>
          <ul className="flex flex-col gap-0.5">
            {Object.entries(s.valueByCurrency).map(([currency, amount]) => (
              <li key={currency} className="flex items-center justify-between gap-2 text-ink-dim">
                <span>{currency}</span>
                <span className="font-mono font-medium text-ink">{(amount / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {s.bookingCount === 0 && <p className="text-ink-faint">Nema rezervacija za ovaj dan (uz trenutne filtere).</p>}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-2 text-center">
      <div className="font-mono text-lg font-semibold text-ink">{value}</div>
      <div className="text-[11px] text-ink-faint">{label}</div>
    </div>
  );
}

function BreakdownSection({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (
    <div className="mt-2 mb-1">
      <div className="mb-1 text-ink-faint">{title}</div>
      <ul className="flex flex-col gap-0.5">
        {entries.map(([key, count]) => (
          <li key={key} className="flex items-center justify-between gap-2 text-ink-dim">
            <span className="truncate">{key}</span>
            <span className="font-mono text-ink">{count}</span>
          </li>
        ))}
      </ul>
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
  const money = (amount: number) => `${(amount / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} ${item.finalPriceCurrency}`;
  return (
    <div className="rounded-lg border border-border bg-panel p-2 text-xs">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium text-ink">{item.productName}</span>
            {item.stars !== undefined && (
              <span className="flex-shrink-0 rounded bg-panel2 px-1 py-0.5 text-[11px] font-semibold text-warn">{item.stars}*</span>
            )}
          </div>
          {/* Detaljne informacije kao u centralnom panelu (dopuna 26.8.2026, na zahtev vlasnika:
              "u kartici u desnom panelu treba da pišu detaljne informacije kao i u centralnom
              panelu") — popunjeno SAMO kad izvor nosi ta opciona polja (`SelectionItem`
              dopuna, `SelectionContext.tsx`); pravi `QuoteButton.tsx` rezultati i dalje prikazuju
              samo `productType` ispod, isto kao ranije. */}
          {item.destinationCity || item.destinationCountry ? (
            <div className="text-[11px] text-ink-faint">{[item.destinationCountry, item.destinationCity].filter(Boolean).join(', ')}</div>
          ) : (
            <div className="text-[11px] text-ink-faint">{item.productType}</div>
          )}
          {(item.stayFrom || item.stayTo) && (
            <div className="text-[11px] text-ink-faint">
              {item.stayFrom ? new Date(item.stayFrom).toLocaleDateString('sr-RS') : '—'} – {item.stayTo ? new Date(item.stayTo).toLocaleDateString('sr-RS') : '—'}
            </div>
          )}
          {item.boardTypeLabel && <div className="text-[11px] text-ink-faint">{item.boardTypeLabel}</div>}
        </div>
        <button onClick={onRemove} title="Ukloni iz selekcije" className="flex-shrink-0 text-ink-faint hover:text-danger">
          <Icon name="close" />
        </button>
      </div>

      {item.roomLines && item.roomLines.length > 0 ? (
        <div className="mt-1.5 flex flex-col gap-0.5">
          {item.roomLines.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-ink-dim">
              <span>
                Soba {i + 1}: {r.adults} odrasl{r.adults === 1 ? 'a' : 'e'}
                {r.children > 0 ? ` + ${r.children} det${r.children === 1 ? 'e' : 'ece'}${r.childrenAges?.length ? ` (${r.childrenAges.join(', ')}g)` : ''}` : ''}
              </span>
              <span className="font-mono">{money(r.price)}</span>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-1">
            <span className="font-medium text-ink-faint">Ukupno</span>
            <span className="font-mono font-semibold text-ink">{money(item.finalPrice)}</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono font-semibold text-ink">{money(item.finalPrice)}</span>
          {item.sourceType === 'API' && item.quoteExpiresAt && <ExpiryBadge quoteExpiresAt={item.quoteExpiresAt} />}
        </div>
      )}
    </div>
  );
}
