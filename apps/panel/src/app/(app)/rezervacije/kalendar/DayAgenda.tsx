import TabLink from '@/components/TabLink';
import type { DayDetail, DayDetailEntry } from './types';

const SECTIONS: { key: keyof DayDetail; title: string; dot: string }[] = [
  { key: 'ARRIVAL', title: 'Dolasci', dot: 'bg-ok' },
  { key: 'DEPARTURE', title: 'Odlasci', dot: 'bg-warn' },
  { key: 'STAYOVER', title: 'U toku', dot: 'bg-accent2' },
  { key: 'SINGLE_DAY', title: 'Jednodnevno', dot: 'bg-accent-strong' },
];

// Spisak termina jednog dana — deljen između "Dan" prikaza (veći, sa naslovima sekcija) i
// kolona "Nedelja" prikaza (kompaktniji, `compact` prop). Klik na termin otvara pun zapis
// rezervacije U ISTOM tabu (`TabLink`/`navigateInTab`, isti obrazac kao `rezervacije/lista`).
export default function DayAgenda({ detail, compact = false }: { detail: DayDetail; compact?: boolean }) {
  const hasAny = SECTIONS.some((s) => detail[s.key].length > 0);
  if (!hasAny) {
    return compact ? null : <p className="text-xs text-ink-faint">Nema rezervacija za ovaj dan (uz trenutne filtere).</p>;
  }
  return (
    <div className={compact ? 'flex flex-col gap-1.5' : 'flex flex-col gap-3'}>
      {SECTIONS.map(({ key, title, dot }) =>
        detail[key].length === 0 ? null : (
          <div key={key}>
            {!compact && <h3 className="mb-1 text-xs font-medium text-ink-faint">{title}</h3>}
            <div className="flex flex-col gap-1">
              {detail[key].map((e) => (
                <Entry key={e.bookingItemId} entry={e} dot={dot} compact={compact} />
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

function Entry({ entry, dot, compact }: { entry: DayDetailEntry; dot: string; compact: boolean }) {
  return (
    <TabLink
      href={`/rezervacije/lista/${entry.bookingNumber}`}
      label={entry.bookingNumber}
      className={`flex items-center gap-1.5 rounded border border-transparent bg-panel2 px-1.5 py-1 text-ink hover:border-accent ${compact ? 'text-[11px]' : 'text-xs'}`}
    >
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dot}`} />
      <span className="truncate">
        {compact ? entry.bookingNumber : `${entry.bookingNumber} — ${entry.guests.join(', ') || 'bez imena gosta'}`}
      </span>
    </TabLink>
  );
}
