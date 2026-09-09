'use client';

import { useRowSummary } from '@/components/RowSummaryContext';
import { useTabs } from '@/components/TabsContext';
import Icon from '@/components/Icon';

// M17 spec §7a (dopuna 9.9.2026) — redovi liste dobavljača su do sada bili obični `<div>`-ovi
// bez ijedne radnje: klik nigde nije vodio, desni panel je ostajao prazan.
//
// Sad važi isto pravilo kao na Listi rezervacija (vlasnikov zahtev): klik BILO GDE na red otvara
// brz pregled u desnom panelu, a ikonica na kraju reda otvara pun zapis u novom tabu.
// `stopPropagation` na ikonici sprečava da isti klik uradi oboje.

export interface SupplierRow {
  id: string;
  name: string;
  type: string;
  country: string;
  contactName: string;
  contactEmail: string;
}

export default function SuppliersList({ suppliers }: { suppliers: SupplierRow[] }) {
  const { showSummary } = useRowSummary();
  const { openTab } = useTabs();

  if (suppliers.length === 0) {
    return (
      <p className="p-4 text-center text-xs text-ink-faint">
        Nema dobavljača koji odgovaraju filterima.
      </p>
    );
  }

  return (
    <>
      {suppliers.map((s) => (
        <div
          key={s.id}
          role="button"
          tabIndex={0}
          onClick={() => showSummary({ kind: 'supplier', ...s })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              showSummary({ kind: 'supplier', ...s });
            }
          }}
          className="flex cursor-pointer items-center justify-between gap-3 border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
        >
          <div className="min-w-0">
            <div className="font-medium text-ink">{s.name}</div>
            <div className="text-xs text-ink-faint">
              {s.type} · {s.country} · {s.contactName} ({s.contactEmail})
            </div>
          </div>
          <button
            type="button"
            title="Otvori ugovore ovog dobavljača"
            onClick={(e) => {
              e.stopPropagation();
              openTab(`/ugovori?supplierId=${s.id}`, s.name);
            }}
            className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded text-ink-faint hover:bg-sunken hover:text-accent-strong"
          >
            <Icon name="link-external" />
          </button>
        </div>
      ))}
    </>
  );
}
