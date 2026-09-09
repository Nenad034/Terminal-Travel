'use client';

import Icon from './Icon';
import type {
  ContractRowSummary,
  ProductRowSummary,
  SupplierRowSummary,
} from './RowSummaryContext';

// M17 spec §7a (dopuna 9.9.2026) — kartice desnog panela za tri liste koje su do sada tamo
// pokazivale samo „prevuci ovde nešto": Katalog, Dobavljači, Ugovori.
//
// Dugme „Otvori pun zapis" je NAMERNO isto (ikonica `link-external`, isti tekst) kao ono koje
// već postoji na sažetku rezervacije — vlasnikov zahtev je bio doslovno „znate već koju ikonu
// da koristite, već je imate u desnom panelu za otvaranje konkretne rezervacije". Isti potez na
// tri nova mesta ne sme da izgleda kao tri različita poteza.

function OtvoriPunZapis({ onOpen, tekst }: { onOpen: () => void; tekst: string }) {
  return (
    <button
      onClick={onOpen}
      title={tekst}
      className="mb-3 flex w-full items-center justify-center gap-1.5 rounded border border-accent px-2 py-1.5 text-[11px] font-semibold text-accent hover:bg-accent-soft"
    >
      <Icon name="link-external" /> {tekst}
    </button>
  );
}

function Red({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between gap-2 border-b border-border py-1 last:border-b-0">
      <span className="flex-shrink-0 text-ink-faint">{label}</span>
      <span className="min-w-0 break-words text-right text-ink">{value}</span>
    </div>
  );
}

function Omotac({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto p-3 text-xs">{children}</div>;
}

export function ProductSummaryCard({
  summary: s,
  onOpen,
}: {
  summary: ProductRowSummary;
  onOpen: () => void;
}) {
  return (
    <Omotac>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-semibold text-ink">{s.name}</span>
        <span className="flex-shrink-0 rounded bg-panel px-2 py-0.5 text-[11px] font-medium text-ink-dim">
          {s.status}
        </span>
      </div>
      <OtvoriPunZapis onOpen={onOpen} tekst="Otvori pun zapis" />
      <Red label="Vrsta proizvoda" value={s.type} />
      <Red label="Destinacija" value={`${s.destinationCity}, ${s.destinationCountry}`} />
      <Red label="Dobavljač" value={s.supplierName ?? '—'} />
      <Red
        label="Izvor"
        value={
          s.sourceType === 'CONTRACTED' ? 'Direktan ugovor' : `API: ${s.sourceProvider ?? '—'}`
        }
      />
    </Omotac>
  );
}

export function SupplierSummaryCard({
  summary: s,
  onOpen,
}: {
  summary: SupplierRowSummary;
  onOpen: () => void;
}) {
  return (
    <Omotac>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-semibold text-ink">{s.name}</span>
        <span className="flex-shrink-0 rounded bg-panel px-2 py-0.5 text-[11px] font-medium text-ink-dim">
          {s.type}
        </span>
      </div>
      <OtvoriPunZapis onOpen={onOpen} tekst="Otvori ugovore ovog dobavljača" />
      {/* „Država" je sedište firme, ne destinacija — natpis to kaže, da se filter „Grčka"
          (koji gađa proizvode) ne pomeša sa ovim poljem. */}
      <Red label="Država sedišta" value={s.country} />
      <Red label="Kontakt" value={s.contactName} />
      <Red label="E-pošta" value={s.contactEmail} />
    </Omotac>
  );
}

export function ContractSummaryCard({
  summary: s,
  onOpen,
}: {
  summary: ContractRowSummary;
  onOpen: () => void;
}) {
  const datum = (v: string) => (v ? new Date(v).toLocaleDateString('sr-RS') : '—');
  return (
    <Omotac>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-mono font-semibold text-ink">{s.contractNumber}</span>
        <span className="flex-shrink-0 rounded bg-panel px-2 py-0.5 text-[11px] font-medium text-ink-dim">
          {s.status}
        </span>
      </div>
      <OtvoriPunZapis onOpen={onOpen} tekst="Otvori pun zapis" />
      <Red label="Dobavljač" value={s.supplierName} />
      <Red label="Važi od" value={datum(s.validFrom)} />
      <Red label="Važi do" value={datum(s.validTo)} />
      <Red label="Valuta" value={s.currency} />
    </Omotac>
  );
}
