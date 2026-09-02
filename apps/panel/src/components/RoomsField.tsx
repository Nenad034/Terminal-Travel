'use client';

import Icon from './Icon';
import {
  MAX_CHILD_AGE,
  MAX_ROOMS,
  setChildCount,
  type SearchRoom,
} from '@/lib/search-rooms';

// Unos soba u formi pretrage smeštaja — M5 spec §3.0c.1/§3.2a/§3.0g.6, na vlasnikov zahtev
// (3.9.2026): „kada se unese broj dece treba da se pojave isti broj polja za unos godina dece.
// Takođe treba da postoji i link Dodaj sobu sa istom formom za odrasle i decu iz prethodne sobe."
//
// Dve odluke koje se vide u ponašanju:
//  1. **Polja za uzrast se pojavljuju čim se poveća broj dece**, jedno po detetu, i moraju biti
//     popunjena. Cena deteta ide kroz `age_pricing[]` (M5 §3.2b) — dete od 2 i dete od 14 nisu
//     ista cena, pa "2 deteta" bez uzrasta nije podatak nego pretpostavka.
//  2. **"Dodaj sobu" kopira poslednju sobu**, ne pravi praznu. Druga soba je najčešće slična
//     prvoj (porodica koja uzima dve sobe), pa kopija štedi ponovno kucanje; sve se posle menja.
export default function RoomsField({
  rooms,
  onChange,
}: {
  rooms: SearchRoom[];
  onChange: (next: SearchRoom[]) => void;
}) {
  function update(index: number, next: SearchRoom) {
    onChange(rooms.map((r, i) => (i === index ? next : r)));
  }

  function addRoom() {
    if (rooms.length >= MAX_ROOMS) return;
    const last = rooms[rooms.length - 1];
    // Kopija poslednje sobe, uključujući uzraste dece — vlasnikov zahtev ("sa istom formom za
    // odrasle i decu iz prethodne sobe").
    onChange([...rooms, { adults: last.adults, childrenAges: [...last.childrenAges] }]);
  }

  return (
    <div className="sm:col-span-2">
      <span className="text-ink-faint">sobe i putnici</span>
      <div className="mt-1 space-y-2">
        {rooms.map((room, i) => (
          <div key={i} className="rounded border border-border bg-sunken p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-medium text-ink-dim">{rooms.length > 1 ? `Soba ${i + 1}` : 'Soba'}</span>
              {rooms.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(rooms.filter((_, j) => j !== i))}
                  title="Ukloni ovu sobu"
                  className="text-ink-faint hover:text-danger"
                >
                  <Icon name="close" />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <label className="flex-1 text-[11px] text-ink-faint">
                odrasli
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={room.adults}
                  onChange={(e) => update(i, { ...room, adults: Math.max(1, Number(e.target.value) || 1) })}
                  className="input mt-0.5 w-full"
                />
              </label>
              <label className="flex-1 text-[11px] text-ink-faint">
                deca
                <input
                  type="number"
                  min={0}
                  max={8}
                  value={room.childrenAges.length}
                  onChange={(e) => update(i, setChildCount(room, Math.max(0, Number(e.target.value) || 0)))}
                  className="input mt-0.5 w-full"
                />
              </label>
            </div>

            {room.childrenAges.length > 0 && (
              <div className="mt-2">
                <span className="text-[11px] text-ink-faint">
                  uzrast dece <span className="text-danger">*</span>
                </span>
                <div className="mt-0.5 flex flex-wrap gap-1.5">
                  {room.childrenAges.map((age, ci) => (
                    <label key={ci} className="flex items-center gap-1 text-[11px] text-ink-faint">
                      <span>{ci + 1}.</span>
                      <select
                        value={age}
                        onChange={(e) =>
                          update(i, {
                            ...room,
                            childrenAges: room.childrenAges.map((a, j) => (j === ci ? e.target.value : a)),
                          })
                        }
                        className="input w-16 px-1 py-1"
                        required
                      >
                        <option value="">—</option>
                        {Array.from({ length: MAX_CHILD_AGE + 1 }, (_, n) => (
                          <option key={n} value={String(n)}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-ink-faint">
                  Uzrast na dan putovanja — cena deteta zavisi od njega, pa bez unosa ponuda nije obavezujuća.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {rooms.length < MAX_ROOMS && (
        <button type="button" onClick={addRoom} className="mt-1.5 flex items-center gap-1 text-[11px] text-accent hover:text-accent-strong">
          <Icon name="add" />
          Dodaj sobu
        </button>
      )}
    </div>
  );
}
