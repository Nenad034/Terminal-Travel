// Vizuelni prikaz izveštaja (4.9.2026, na zahtev vlasnika: "omogucite i vizuelni prikaz, neki
// namoderniji novi, ali jednostavan i sveden, najvaznije je da je jasan") — dopuna postojećih
// `BucketTable`/`Stat` tabela, ne zamena (URL prekidač "tabela / grafik" u `page.tsx`, podrazumevano
// ostaje tabela — tačno onoliko koliko je traženo, "i").
//
// Horizontalni bar-grafik (magnituda po kategoriji — najčitljiviji oblik za "prihod po destinaciji/
// kanalu/tipu", nema potrebe za linijskim/kružnim grafikom kad nema vremenske ose). Nema JS/hover
// stanja — ceo panel je server-renderovan (page.tsx je async server komponenta, isti obrazac kao
// ostatak M13 ekrana), pa je i ovaj grafik čist SVG/CSS bez 'use client': hover otkriva vrednost
// preko nativnog <title> (radi bez JS-a), red se blago osvetli na hover preko CSS `group-hover`.
//
// Boje NISU nova paleta — koriste postojeće tokene panela (`--accent`/`--accent2`, dizajn dok.
// §2.0f) da grafik prati temu (svetli/dim/tamni) automatski, isto kao svaki drugi element panela.
// Traka „ispod" (bg-sunken) je isti token koji već nosi ulogu "utonule" površine (§6h) — ovde
// služi kao neispunjen trag/skala, ne nova boja.

export interface ChartRow {
  key: string;
}

export interface ChartSeries<T extends ChartRow> {
  label: string;
  /** CSS boja — `var(--accent)`/`var(--accent2)`, nikad sirov heks (prati temu). */
  color: string;
  value: (row: T) => number;
  /** Iznos u centima (M10/M13 konvencija) — deli sa 100 i formatira kao novac. */
  money?: boolean;
}

function formatChartValue(value: number, money?: boolean): string {
  return money ? (value / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 }) : value.toLocaleString('sr-RS');
}

/** Udeo vrednosti u zbiru cele serije, kao procenat — "—" kad je zbir nula. */
function formatSharePct(value: number, total: number): string {
  if (total === 0) return '—';
  return `${((value / total) * 100).toLocaleString('sr-RS', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export default function BarChart<T extends ChartRow>({
  rows,
  series,
  limit = 8,
}: {
  rows: T[];
  series: ChartSeries<T>[];
  /** Koliko kategorija se prikazuje (sortirano po prvoj seriji, opadajuće) — grafik postoji da
   * bi se jednim pogledom video obrazac, ne da ponovi celu tabelu ispod sebe. */
  limit?: number;
}) {
  if (rows.length === 0 || series.length === 0) {
    return <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-ink-faint">Nema podataka za zadate filtere.</p>;
  }

  const sorted = [...rows].sort((a, b) => series[0].value(b) - series[0].value(a));
  const shown = sorted.slice(0, limit);
  const hiddenCount = sorted.length - shown.length;
  const max = Math.max(1, ...shown.flatMap((r) => series.map((s) => s.value(r))));
  // Udeo u procentima (4.9.2026, na zahtev vlasnika: "prikazite i u % u obe vrste izvestaja")
  // — zbir po CELOJ grupi (svi redovi, ne samo prvih `limit`), isti princip kao BucketTable.
  const totals = series.map((s) => rows.reduce((sum, r) => sum + s.value(r), 0));

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-panel p-3">
      {/* Legenda — obavezna za dve i više serija (dataviz §6), da identitet nikad ne zavisi
          isključivo od boje; jedna serija je nema (naslov kartice iznad već kaže šta se prikazuje). */}
      {series.length > 1 && (
        <div className="flex items-center gap-3 text-[11px] text-ink-faint">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} aria-hidden />
              {s.label}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {shown.map((row) => (
          <div key={row.key} className="group flex items-center gap-2 rounded px-1 py-0.5 -mx-1 hover:bg-sunken">
            <span className="w-28 flex-none truncate text-xs text-ink-dim" title={row.key}>
              {row.key}
            </span>
            <div className="flex flex-1 flex-col gap-0.5">
              {series.map((s, i) => {
                const value = s.value(row);
                const barPct = value > 0 ? Math.max((value / max) * 100, 2) : 0;
                const share = formatSharePct(value, totals[i]);
                return (
                  <div
                    key={s.label}
                    className="flex items-center gap-1.5"
                    title={`${row.key} — ${s.label}: ${formatChartValue(value, s.money)} (${share})`}
                  >
                    <div className="h-2.5 flex-1 overflow-hidden rounded-r-full bg-sunken">
                      <div className="h-2.5 rounded-r-full transition-[width]" style={{ width: `${barPct}%`, background: s.color }} />
                    </div>
                    <span className="w-28 flex-none text-right font-mono text-[11px] tabular-nums text-ink-faint">
                      {formatChartValue(value, s.money)} ({share})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {hiddenCount > 0 && <p className="text-[11px] text-ink-faint">+ još {hiddenCount} — vidi tabelu ispod</p>}
    </div>
  );
}
