'use client';

import { useRowSummary } from '@/components/RowSummaryContext';
import { useTabs } from '@/components/TabsContext';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/badge';

// M17 spec §7a (dopuna 9.9.2026, vlasnikov zahtev: „Kada se klikne bilo gde u traku neka se
// otvori desni panel sa brzim informacijama. Omogućite da klikom na ikonu se iz desnog panela
// ili iz trake otvori strana za konkretan sadržaj").
//
// PROMENA PONAŠANJA, ne dopuna: red je do sada bio `<Link>` — klik bilo gde je odmah odvodio sa
// ekrana. Sad klik na red otvara brz pregled u desnom panelu, a ikonica na kraju reda otvara pun
// zapis. Isti raspored kao na Listi rezervacija, koja je i navedena kao uzor.
//
// Anchor `#contract-{id}` OSTAJE — dashboard upozorenje „M3 — rokovi povrata alotmana" skače na
// njega (23.8.2026), pa bi njegovo uklanjanje tiho pokvarilo tu vezu.

export interface ContractRow {
  id: string;
  contractNumber: string;
  supplierName: string;
  status: string;
  currency: string;
  validFrom: string;
  validTo: string;
}

export default function ContractsList({ contracts }: { contracts: ContractRow[] }) {
  const { showSummary } = useRowSummary();
  const { openTab } = useTabs();

  if (contracts.length === 0) {
    return (
      <p className="p-4 text-center text-xs text-ink-faint">
        Nema ugovora koji odgovaraju filterima.
      </p>
    );
  }

  return (
    <>
      {contracts.map((c) => (
        <div
          key={c.id}
          id={`contract-${c.id}`}
          role="button"
          tabIndex={0}
          onClick={() => showSummary({ kind: 'contract', ...c })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              showSummary({ kind: 'contract', ...c });
            }
          }}
          className="flex cursor-pointer items-center justify-between gap-3 border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0 hover:bg-panel2"
        >
          <div className="min-w-0">
            <div className="font-medium text-ink">
              {c.contractNumber} <span className="text-ink-faint">— {c.supplierName}</span>
            </div>
            <div className="text-xs text-ink-faint">
              {c.currency} · {new Date(c.validFrom).toLocaleDateString('sr-RS')} –{' '}
              {new Date(c.validTo).toLocaleDateString('sr-RS')}
            </div>
          </div>
          <span className="flex flex-shrink-0 items-center gap-2">
            <StatusBadge status={c.status} />
            <button
              type="button"
              title="Otvori pun zapis ugovora"
              onClick={(e) => {
                e.stopPropagation();
                openTab(`/ugovori/${c.id}`, c.contractNumber);
              }}
              className="flex h-[26px] w-[26px] items-center justify-center rounded text-ink-faint hover:bg-sunken hover:text-accent-strong"
            >
              <Icon name="link-external" />
            </button>
          </span>
        </div>
      ))}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={
        status === 'ACTIVE'
          ? 'ok'
          : status === 'EXPIRED' || status === 'TERMINATED'
            ? 'danger'
            : 'secondary'
      }
    >
      {status}
    </Badge>
  );
}
