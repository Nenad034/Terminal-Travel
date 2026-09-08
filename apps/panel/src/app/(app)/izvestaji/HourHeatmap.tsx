// Toplotna mapa "sat × dan u nedelji" za M13 §4.4 "Vremenski obrasci" (8.9.2026, na zahtev
// vlasnika: "omogucite graficki prikaz i vremenskih obrazaca"). Tab "Vremenski obrasci" je bio
// jedini na ekranu Izveštaji na kom prekidač tabela/grafik nije radio ništa — uvek tabela.
//
// ZAŠTO toplotna mapa, a ne bar-grafik kao ostali izveštaji: podatak ovde ima DVE dimenzije
// odjednom (7 dana × 24 sata = 168 polja). Bar-grafik bi ih izravnao u 168 traka i obrazac bi
// nestao; mreža ga pokazuje jednim pogledom ("radnim danima ujutru", "vikendom uveče"). Isti
// oblik koji M13 spec §4.4 navodi kao istraženu praksu ("kontakt-centar heatmapa").
//
// Boje NISU nova paleta — jedna jedina nijansa (`--accent`, dizajn dok. §2.0f) u pet stepena
// providnosti preko `bg-sunken` traga, tj. klasična sekvencijalna skala "svetlo → tamno" za
// magnitudu. Providnost se dobija zasebnim slojem sa `opacity` (ne poluprovidnom bojom), da
// vrednost ostane vezana za token teme i da prati svetli/dim/tamni mod bez ijedne nove vrednosti.
//
// Brojevi NISU upisani u svako polje (168 brojeva je zid teksta koji poništava svrhu mape) —
// tačna vrednost stoji u nativnom `<title>` na hover i, i dalje, u tabeli iza prekidača. Izuzetak
// je JEDNO polje sa najvećom vrednošću: ono nosi broj, u `--accent-ink` na punom `--accent`
// (jedini par koji je izmeren, 6.55:1/6.31:1/6.59:1 po dizajn dok. §2.0f — zato se broj i piše
// isključivo na polju pune jačine, nikad na poluprovidnom).

import { DAY_OF_WEEK_LABELS } from './constants';

export interface HourDayCell {
  hour: number;
  dayOfWeek: number;
  count: number;
}

/** Kratke oznake dana za zaglavlje reda — pun naziv ostaje u `title`. */
const SHORT_DAY_LABELS = ['ned', 'pon', 'uto', 'sre', 'čet', 'pet', 'sub'];

/** Pet stepena jačine (0 = prazno). Sekvencijalno, jedna nijansa — dataviz pravilo za magnitudu. */
const STEP_OPACITY = [0, 0.2, 0.4, 0.62, 0.82, 1];

/** U koji stepen (0–5) pada vrednost u odnosu na najveću u mreži. */
function intensityStep(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.2) return 1;
  if (ratio <= 0.4) return 2;
  if (ratio <= 0.6) return 3;
  if (ratio <= 0.8) return 4;
  return 5;
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}–${String((hour + 1) % 24).padStart(2, '0')}h`;
}

export default function HourHeatmap({ cells }: { cells: HourDayCell[] }) {
  const total = cells.reduce((sum, c) => sum + c.count, 0);
  if (cells.length === 0 || total === 0) {
    return (
      <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-ink-faint">
        Nema podataka za zadati period.
      </p>
    );
  }

  // Retka lista → puna mreža 7×24 (polje bez zapisa je stvarna nula za taj sat, ne rupa).
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const c of cells) {
    if (c.dayOfWeek >= 0 && c.dayOfWeek < 7 && c.hour >= 0 && c.hour < 24) {
      grid[c.dayOfWeek][c.hour] += c.count;
    }
  }
  const max = Math.max(...grid.flat());
  const dayTotals = grid.map((row) => row.reduce((sum, v) => sum + v, 0));
  const peak = cells.reduce((best, c) => (c.count > best.count ? c : best), cells[0]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-3">
      {/* Jedan izdvojen broj umesto 168 (dataviz: izborno direktno označavanje) — vršni termin. */}
      <p className="text-xs text-ink-dim">
        Najviše:{' '}
        <span className="font-medium text-ink">
          {DAY_OF_WEEK_LABELS[peak.dayOfWeek]} {hourLabel(peak.hour)}
        </span>{' '}
        — {peak.count.toLocaleString('sr-RS')} (
        {((peak.count / total) * 100).toLocaleString('sr-RS', { maximumFractionDigits: 1 })}% od
        ukupno {total.toLocaleString('sr-RS')})
      </p>

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-[10px]">
          <thead>
            <tr>
              <th className="w-8" />
              {Array.from({ length: 24 }, (_, h) => (
                <th key={h} className="w-6 pb-1 font-normal tabular-nums text-ink-faint">
                  {/* Svaki drugi sat — 24 broja jedan do drugog se slivaju. */}
                  {h % 2 === 0 ? String(h).padStart(2, '0') : ''}
                </th>
              ))}
              <th className="pb-1 pl-2 text-right font-medium uppercase tracking-wide text-ink-faint">
                ukupno
              </th>
            </tr>
          </thead>
          <tbody>
            {grid.map((row, day) => (
              <tr key={day}>
                <th
                  className="pr-1 text-right font-normal text-ink-dim"
                  title={DAY_OF_WEEK_LABELS[day]}
                >
                  {SHORT_DAY_LABELS[day]}
                </th>
                {row.map((count, hour) => {
                  const step = intensityStep(count, max);
                  const isPeak = count > 0 && count === max;
                  return (
                    <td key={hour} className="p-0">
                      <div
                        className="relative h-6 w-6 overflow-hidden rounded-sm bg-sunken"
                        title={`${DAY_OF_WEEK_LABELS[day]} ${hourLabel(hour)} — ${count.toLocaleString('sr-RS')}`}
                      >
                        <div
                          className="absolute inset-0"
                          style={{ background: 'var(--accent)', opacity: STEP_OPACITY[step] }}
                          aria-hidden
                        />
                        {isPeak && (
                          <span className="relative flex h-full w-full items-center justify-center font-mono text-[9px] font-semibold tabular-nums text-accent-ink">
                            {count}
                          </span>
                        )}
                        <span className="sr-only">
                          {DAY_OF_WEEK_LABELS[day]} {hourLabel(hour)}: {count}
                        </span>
                      </div>
                    </td>
                  );
                })}
                <td className="pl-2 text-right font-mono text-[11px] tabular-nums text-ink-dim">
                  {dayTotals[day].toLocaleString('sr-RS')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Skala — bez nje polje u boji ne znači ništa. */}
      <div className="flex items-center gap-1.5 text-[10px] text-ink-faint">
        <span>manje</span>
        {STEP_OPACITY.map((o, i) => (
          <span key={i} className="h-3 w-5 overflow-hidden rounded-sm bg-sunken">
            <span
              className="block h-full w-full"
              style={{ background: 'var(--accent)', opacity: o }}
            />
          </span>
        ))}
        <span>više (najviše {max.toLocaleString('sr-RS')})</span>
      </div>
    </div>
  );
}
