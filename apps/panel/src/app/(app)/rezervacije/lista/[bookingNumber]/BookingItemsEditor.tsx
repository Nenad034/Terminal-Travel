'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import { PRODUCT_ICONS } from '@/lib/search-product-types';
import type { ItemSourceType, MockBookingItem } from '../mock-data';

const SOURCE_LABEL: Record<ItemSourceType, string> = {
  CONTRACTED: 'Ručno — biram iz kataloga (država/destinacija/hotel/soba/usluga) + ulazna cena i marža',
  API: 'Putem API konekcije — cena i uslovi dolaze od dobavljača, unosim samo putnike',
  MANUAL: 'Iz baze već unetih aranžmana — ručno ili uz AI-agent asistirano popunjavanje',
};

function toUnits(cents: number): string {
  return (cents / 100).toString();
}
function toCents(units: string): number {
  const n = Number(units.replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
function money(cents: number, currency: string): string {
  return `${(cents / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} ${currency}`;
}

interface Draft {
  sourceType: ItemSourceType;
  country: string;
  destinationCity: string;
  hotelName: string;
  roomType: string;
  serviceType: string;
  baseCost: string;
  marginPercent: string;
  marginAmount: string;
  finalPrice: string;
}

function toDraft(item: MockBookingItem): Draft {
  return {
    sourceType: item.sourceType,
    country: item.country,
    destinationCity: item.destinationCity,
    hotelName: item.hotelName,
    roomType: item.roomType,
    serviceType: item.serviceType,
    baseCost: toUnits(item.baseCost),
    marginPercent: item.marginPercent.toString(),
    marginAmount: toUnits(item.marginAmount),
    finalPrice: toUnits(item.finalPrice),
  };
}

// "Izmeni" — modul po segmentu (23.8.2026, na zahtev vlasnika, videti komentar u mock-data.ts za
// pun kontekst tri načina unosa). Sve izmene ostaju SAMO u klijentskoj sesiji (React state u
// roditelju, `BookingRecordClient.tsx`) — mock lista nema pravu bazu na koju bi se upisivale, ali
// svaka sačuvana izmena ipak dobija zapis u toku rezervacije (workflow/audit log), tačno kako je
// vlasnik tražio ("za sve to treba da postoji zapis u work flow").
export default function BookingItemsEditor({
  items,
  onSaveItem,
  onAddItem,
}: {
  items: MockBookingItem[];
  onSaveItem: (id: string, patch: Partial<MockBookingItem>, changeSummary: string) => void;
  onAddItem: (item: MockBookingItem) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  function startEdit(item: MockBookingItem) {
    setEditingId(item.id);
    setDraft(toDraft(item));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function updatePrice(field: 'baseCost' | 'marginPercent' | 'marginAmount' | 'finalPrice', value: string) {
    if (!draft) return;
    const next = { ...draft, [field]: value };
    const base = toCents(next.baseCost);
    if (field === 'marginPercent') {
      const amount = Math.round((base * Number(value.replace(',', '.') || 0)) / 100);
      next.marginAmount = toUnits(amount);
      next.finalPrice = toUnits(base + amount);
    } else if (field === 'marginAmount') {
      const amount = toCents(value);
      next.finalPrice = toUnits(base + amount);
      next.marginPercent = base > 0 ? (Math.round((amount / base) * 1000) / 10).toString() : '0';
    } else if (field === 'finalPrice') {
      const finalCents = toCents(value);
      const amount = finalCents - base;
      next.marginAmount = toUnits(amount);
      next.marginPercent = base > 0 ? (Math.round((amount / base) * 1000) / 10).toString() : '0';
    } else if (field === 'baseCost') {
      const amount = toCents(next.marginAmount);
      next.finalPrice = toUnits(base + amount);
    }
    setDraft(next);
  }

  function save(item: MockBookingItem) {
    if (!draft) return;
    const patch: Partial<MockBookingItem> = {
      sourceType: draft.sourceType,
      country: draft.country,
      destinationCity: draft.destinationCity,
      hotelName: draft.hotelName,
      roomType: draft.roomType,
      serviceType: draft.serviceType,
      baseCost: toCents(draft.baseCost),
      marginPercent: Number(draft.marginPercent.replace(',', '.')) || 0,
      marginAmount: toCents(draft.marginAmount),
      finalPrice: toCents(draft.finalPrice),
    };
    const changes: string[] = [];
    if (patch.hotelName !== item.hotelName) changes.push(`hotel: "${item.hotelName}" → "${patch.hotelName}"`);
    if (patch.roomType !== item.roomType) changes.push(`soba/usluga: "${item.roomType}" → "${patch.roomType}"`);
    if (patch.finalPrice !== item.finalPrice) changes.push(`izlazna cena: ${money(item.finalPrice, item.currency)} → ${money(patch.finalPrice!, item.currency)}`);
    if (patch.baseCost !== item.baseCost) changes.push(`ulazna cena: ${money(item.baseCost, item.currency)} → ${money(patch.baseCost!, item.currency)}`);
    if (patch.sourceType !== item.sourceType) changes.push(`način unosa: ${SOURCE_LABEL[item.sourceType]} → ${SOURCE_LABEL[patch.sourceType!]}`);
    const summary = changes.length > 0 ? changes.join('; ') : 'izmena sačuvana bez promene vrednosti';
    onSaveItem(item.id, patch, summary);
    cancelEdit();
  }

  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Icon name="checklist" className="text-accent" /> Stavke (segmenti)
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className="rounded border border-border bg-panel2 p-3 text-xs">
            {editingId === item.id && draft ? (
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-ink-faint">Način unosa</span>
                  <select
                    value={draft.sourceType}
                    onChange={(e) => setDraft({ ...draft, sourceType: e.target.value as ItemSourceType })}
                    className="rounded border border-ink-faint bg-panel px-2 py-1 text-xs text-ink"
                  >
                    {(Object.keys(SOURCE_LABEL) as ItemSourceType[]).map((k) => (
                      <option key={k} value={k}>
                        {SOURCE_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>

                {draft.sourceType === 'MANUAL' && (
                  <p className="rounded bg-warn-bg px-2 py-1.5 text-[11px] text-warn">
                    AI-agent asistirano popunjavanje (iz nalepljenog linka/baze aranžmana) čeka poseban prolaz — M15 modul još nije povezan na ovaj mock ekran. Za sada popunite polja ispod ručno.
                  </p>
                )}
                {draft.sourceType === 'API' && (
                  <p className="rounded bg-panel px-2 py-1.5 text-[11px] text-ink-faint">
                    Cena i uslovi dolaze od dobavljača preko API-ja — polja cene ispod su informativna (nisu konačna garancija dok se ne pozove M4 ponovo), agent ovde tipično menja samo opisna polja/putnike.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Država" value={draft.country} onChange={(v) => setDraft({ ...draft, country: v })} />
                  <Field label="Destinacija" value={draft.destinationCity} onChange={(v) => setDraft({ ...draft, destinationCity: v })} />
                  <Field label="Hotel/objekat" value={draft.hotelName} onChange={(v) => setDraft({ ...draft, hotelName: v })} />
                  <Field label="Vrsta sobe" value={draft.roomType} onChange={(v) => setDraft({ ...draft, roomType: v })} />
                  <Field label="Usluga" value={draft.serviceType} onChange={(v) => setDraft({ ...draft, serviceType: v })} />
                </div>

                <div className="mt-1 grid grid-cols-4 gap-2 rounded border border-border bg-panel p-2">
                  <Field label="Ulazna cena" value={draft.baseCost} onChange={(v) => updatePrice('baseCost', v)} disabled={draft.sourceType === 'API'} numeric />
                  <Field label="Marža %" value={draft.marginPercent} onChange={(v) => updatePrice('marginPercent', v)} disabled={draft.sourceType === 'API'} numeric />
                  <Field label="Marža iznos" value={draft.marginAmount} onChange={(v) => updatePrice('marginAmount', v)} disabled={draft.sourceType === 'API'} numeric />
                  <Field label="Izlazna cena" value={draft.finalPrice} onChange={(v) => updatePrice('finalPrice', v)} disabled={draft.sourceType === 'API'} numeric />
                </div>

                <div className="mt-1 flex justify-end gap-1.5">
                  <button onClick={cancelEdit} className="rounded px-2 py-1 text-[11px] text-ink-faint hover:text-ink">
                    Otkaži
                  </button>
                  <button onClick={() => save(item)} className="rounded bg-accent px-3 py-1 text-[11px] font-semibold text-accent-ink hover:bg-accent-strong">
                    Sačuvaj izmenu
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-ink">
                    <Icon name={PRODUCT_ICONS.find((p) => p.types.includes(item.productType))?.icon ?? 'question'} />
                    {item.hotelName} <span className="text-ink-faint">— {item.roomType}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-faint">
                    {item.destinationCity}, {item.country} · {SOURCE_LABEL[item.sourceType]}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-mono text-ink">{money(item.finalPrice, item.currency)}</div>
                    <div className="text-xs text-ink-faint">ulazna {money(item.baseCost, item.currency)} · marža {item.marginPercent}%</div>
                  </div>
                  <button onClick={() => startEdit(item)} title="Izmeni stavku" className="flex h-[26px] w-[26px] items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-accent">
                    <Icon name="edit" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => {
          const newItem: MockBookingItem = {
            id: `item-${Date.now()}`,
            sourceType: 'CONTRACTED',
            productType: items[0]?.productType ?? 'ACCOMMODATION',
            country: '',
            destinationCity: '',
            hotelName: '',
            roomType: '',
            serviceType: '',
            baseCost: 0,
            marginPercent: 0,
            marginAmount: 0,
            finalPrice: 0,
            currency: items[0]?.currency ?? 'EUR',
          };
          onAddItem(newItem);
          setEditingId(newItem.id);
          setDraft(toDraft(newItem));
        }}
        className="mt-2 flex items-center gap-1.5 text-[11px] text-accent hover:underline"
      >
        <Icon name="add" /> Dodaj stavku
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  numeric?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-ink-faint">{label}</span>
      <input
        value={value}
        disabled={disabled}
        inputMode={numeric ? 'decimal' : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-ink-faint bg-panel px-2 py-1 text-xs text-ink outline-none focus:border-accent disabled:opacity-40"
      />
    </label>
  );
}
