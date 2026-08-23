'use client';

import Icon from '@/components/Icon';
import { BRANCHES, USERS } from './mock-data';
import type { ColumnKey } from './BookingsTable';

export interface ExtraFilters {
  branch: string;
  assignedUser: string;
  supplierName: string;
  partnerName: string;
}

const COLUMN_LABELS: Record<ColumnKey, string> = {
  bookingNumber: 'Broj',
  createdAt: 'Kreirano (dd/mm/gggg...dd/mm/gggg)',
  buyerName: 'Nosilac / država / destinacija / hotel',
  channel: 'Kanal',
  status: 'Status',
  paymentStatus: 'Uplata',
  stayFrom: 'Dolazak (dd/mm/gggg...dd/mm/gggg)',
  stayTo: 'Odlazak (dd/mm/gggg...dd/mm/gggg)',
};

// Dopuna (23.8.2026, na zahtev vlasnika: "Dodati iznad liste rezervacija i ikonu za Filtere.
// Klikom na taj link treba da se otvori modul sa svim filterima ukljucujuci i one brze po
// kolonama koje smo vec kreirali i dodatnim filterima (Poslovnica, User, Dobavljač, Partner...
// dodavacemo jos)") — isto stanje (`filters`/`extraFilters`) kao brzi filteri ispod naziva
// kolone, ovaj modul je samo DRUGI PRIKAZ istog stanja (jedan izvor istine), ne paralelan
// mehanizam — izmena ovde se odmah odražava i u tabeli, i obrnuto.
export default function FiltersModal({
  columnFilters,
  onColumnFilterChange,
  extraFilters,
  onExtraFiltersChange,
  onClose,
}: {
  columnFilters: Record<ColumnKey, string>;
  onColumnFilterChange: (key: ColumnKey, value: string) => void;
  extraFilters: ExtraFilters;
  onExtraFiltersChange: (f: ExtraFilters) => void;
  onClose: () => void;
}) {
  const inputClass =
    'w-full rounded border border-ink-faint bg-panel px-2 py-1 text-xs text-ink outline-none placeholder:text-ink-faint focus:border-accent';

  function setExtra(key: keyof ExtraFilters, value: string) {
    onExtraFiltersChange({ ...extraFilters, [key]: value });
  }

  function clearAll() {
    (Object.keys(columnFilters) as ColumnKey[]).forEach((k) => onColumnFilterChange(k, ''));
    onExtraFiltersChange({ branch: '', assignedUser: '', supplierName: '', partnerName: '' });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-lg border border-border bg-panel shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-panel2 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Icon name="filter" className="text-accent" />
            Svi filteri
          </div>
          <button onClick={onClose} title="Zatvori" className="text-ink-faint hover:text-ink">
            <Icon name="close" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-3 text-xs">
          <div className="mb-1.5 font-semibold text-ink-faint">Brzi filteri po koloni</div>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-ink-faint">{COLUMN_LABELS[key]}</span>
                <input value={columnFilters[key]} onChange={(e) => onColumnFilterChange(key, e.target.value)} className={inputClass} />
              </label>
            ))}
          </div>

          <div className="mb-1.5 font-semibold text-ink-faint">Dodatni filteri</div>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-ink-faint">Poslovnica</span>
              <select value={extraFilters.branch} onChange={(e) => setExtra('branch', e.target.value)} className={inputClass}>
                <option value="">sve</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-ink-faint">User (zadužen)</span>
              <select value={extraFilters.assignedUser} onChange={(e) => setExtra('assignedUser', e.target.value)} className={inputClass}>
                <option value="">svi</option>
                {USERS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-ink-faint">Dobavljač</span>
              <input value={extraFilters.supplierName} onChange={(e) => setExtra('supplierName', e.target.value)} placeholder="pretraži..." className={inputClass} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-ink-faint">Partner (subagent/firma)</span>
              <input value={extraFilters.partnerName} onChange={(e) => setExtra('partnerName', e.target.value)} placeholder="pretraži..." className={inputClass} />
            </label>
          </div>
          <p className="text-[11px] italic text-ink-faint">Dodavaćemo još filtera po potrebi.</p>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
          <button onClick={clearAll} className="text-xs text-ink-faint hover:text-danger">
            Ukloni sve filtere
          </button>
          <button onClick={onClose} className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong">
            Primeni
          </button>
        </div>
      </div>
    </div>
  );
}
