'use client';

import { useState } from 'react';

// M17 spec §4b.3a (dopuna 9.9.2026, vlasnikov zahtev: „kada se menja bilo šta u vezi kapaciteta
// jednog hotela omogućiti multiselect za tipove smeštaja") — izbor tipova soba čipovima, isti
// oblik koji 4b.0c već propisuje za formu unosa kapaciteta.
//
// Čipovi se prave iz redova koji su VEĆ na ekranu (svi periodi istog ugovora), ne iz globalnog
// spiska — ne može se izabrati soba koja tom objektu ne pripada.
//
// Izbor izlazi kroz skrivena polja `contractPeriodIds`, pa forma ostaje obična `<form action>`
// (server akcija čita `formData.getAll('contractPeriodIds')`) — bez React state-a koji bi morao
// da se prosleđuje kroz `useActionState`.

export interface RoomTypeOption {
  contractPeriodId: string;
  roomType: string;
}

export default function RoomTypeChips({
  opcije,
  podrazumevani,
}: {
  opcije: RoomTypeOption[];
  /** Tip sobe reda sa kog je panel otvoren — uvek izabran na početku. */
  podrazumevani: string;
}) {
  const [izabrani, setIzabrani] = useState<string[]>([podrazumevani]);

  function prebaci(id: string) {
    setIzabrani((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-ink-faint">Tipovi soba</span>
        {/* „Ceo objekat" je i dalje česta radnja i ne sme da traži sedam klikova (§4b.3a). */}
        {opcije.length > 1 && (
          <span className="flex gap-2 text-[10px]">
            <button
              type="button"
              onClick={() => setIzabrani(opcije.map((o) => o.contractPeriodId))}
              className="text-accent-strong hover:underline"
            >
              izaberi sve
            </button>
            <button
              type="button"
              onClick={() => setIzabrani([podrazumevani])}
              className="text-ink-faint hover:underline"
            >
              poništi
            </button>
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {opcije.map((o) => {
          const aktivan = izabrani.includes(o.contractPeriodId);
          return (
            <button
              key={o.contractPeriodId}
              type="button"
              onClick={() => prebaci(o.contractPeriodId)}
              aria-pressed={aktivan}
              className={`rounded-full border px-2 py-0.5 text-[11px] ${
                aktivan
                  ? 'border-accent bg-accent-soft text-accent-strong'
                  : 'border-border text-ink-faint hover:border-accent hover:text-ink'
              }`}
            >
              {o.roomType}
            </button>
          );
        })}
      </div>

      {izabrani.map((id) => (
        <input key={id} type="hidden" name="contractPeriodIds" value={id} />
      ))}

      {/* §4b.3a — masovan potez nad kapacitetom se ne sme desiti „u tišini": kad je izabrano
          više od jednog tipa, forma ih ispisuje poimence pre nego što se klikne potvrda. */}
      {izabrani.length > 1 && (
        <p className="rounded bg-warn-bg px-2 py-1 text-[10px] text-warn">
          Važi za {izabrani.length} tipa soba:{' '}
          {opcije
            .filter((o) => izabrani.includes(o.contractPeriodId))
            .map((o) => o.roomType)
            .join(', ')}
          .
        </p>
      )}
      {izabrani.length === 0 && (
        <p className="rounded bg-danger-bg px-2 py-1 text-[10px] text-danger">
          Izaberite bar jedan tip sobe.
        </p>
      )}
    </div>
  );
}
