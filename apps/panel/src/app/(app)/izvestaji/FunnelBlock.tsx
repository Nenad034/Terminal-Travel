import Icon from '@/components/Icon';
import { FUNNEL_DIMENSION_LABELS, type FunnelDimension } from './constants';

// M13 spec §4.4a (19.9.2026) — "Lijevak": pet stepenica upit → prikazano → ponuda → otvoreno →
// rezervacija, po destinaciji/kanalu/lead-time-u; "prikazano a nije izabrano" po proizvodu;
// "marža po pravilu" (samo uz `report:profitability`). Tabela je jedini prikaz — stepenice se
// čitaju kao procenat prelaza, to je brojka, ne grafik (isti razlog kao §4.4 lead-time kategorije).

export interface FunnelStep {
  key: string;
  searches: number;
  shown: number;
  quotes: number;
  opened: number;
  converted: number;
}
export interface ShownNotChosenRow {
  productId: string;
  productName: string | null;
  shown: number;
  avgRank: number;
  chosen: number;
  converted: number;
}
export interface MarkupRuleRow {
  markupRuleId: string;
  ruleName: string | null;
  shown: number;
  chosen: number;
  converted: number;
  avgMarginPct: number | null;
}
export interface FunnelReport {
  steps?: FunnelStep[];
  rows?: ShownNotChosenRow[] | MarkupRuleRow[];
}

const KORAK = ['upiti', 'prikazano', 'ponude', 'otvorene', 'rezervacije'] as const;

function pct(deo: number, celina: number): string {
  if (!celina) return '–';
  return `${Math.round((deo / celina) * 100)}%`;
}

const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-faint';
const td = 'px-3 py-2 tabular-nums';

export default function FunnelBlock({
  report,
  dimension,
}: {
  report: FunnelReport;
  dimension: FunnelDimension;
}) {
  const naslov = (
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
      <Icon name="filter" className="text-accent" /> {FUNNEL_DIMENSION_LABELS[dimension]}
    </div>
  );
  const prazno = (
    <p className="rounded-lg border border-border bg-panel p-4 text-center text-xs text-ink-faint">
      Nema upita za zadati period — lijevak se puni tek od kada se beleže prikazani rezultati (M5
      §3.0k, 19.9.2026).
    </p>
  );

  if (report.steps) {
    const rows = report.steps;
    if (rows.length === 0)
      return (
        <div>
          {naslov}
          {prazno}
        </div>
      );
    const ukupno = rows.reduce(
      (a, r) => ({
        searches: a.searches + r.searches,
        shown: a.shown + r.shown,
        quotes: a.quotes + r.quotes,
        opened: a.opened + r.opened,
        converted: a.converted + r.converted,
      }),
      { searches: 0, shown: 0, quotes: 0, opened: 0, converted: 0 },
    );
    const red = (r: FunnelStep, jak = false) => (
      <tr key={r.key} className={jak ? 'bg-sunken font-semibold' : 'border-t border-border'}>
        <td className={td}>{r.key}</td>
        <td className={td}>{r.searches}</td>
        <td className={td}>
          {r.shown} <span className="text-ink-faint">({pct(r.shown, r.searches)})</span>
        </td>
        <td className={td}>
          {r.quotes} <span className="text-ink-faint">({pct(r.quotes, r.shown)})</span>
        </td>
        <td className={td}>
          {r.opened} <span className="text-ink-faint">({pct(r.opened, r.quotes)})</span>
        </td>
        <td className={td}>
          {r.converted} <span className="text-ink-faint">({pct(r.converted, r.quotes)})</span>
        </td>
      </tr>
    );
    return (
      <div>
        {naslov}
        <p className="mb-2 text-xs text-ink-faint">
          Procenat u zagradi je prelaz sa prethodne stepenice (ponude i rezervacije u odnosu na
          upite sa rezultatima). „Otvorene" broji ponude koje je kupac otvorio bar jednom.
        </p>
        <div className="overflow-hidden overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-panel-2">
              <tr>
                <th className={th}>grupa</th>
                {KORAK.map((k) => (
                  <th key={k} className={th}>
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => red(r))}
              {red({ ...ukupno, key: 'ukupno' }, true)}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const rows = report.rows ?? [];
  if (rows.length === 0)
    return (
      <div>
        {naslov}
        {prazno}
      </div>
    );

  if (dimension === 'by_markup_rule') {
    const r = rows as MarkupRuleRow[];
    return (
      <div>
        {naslov}
        <div className="overflow-hidden overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-panel-2">
              <tr>
                <th className={th}>pravilo marže</th>
                <th className={th}>prosečna marža</th>
                <th className={th}>prikazano</th>
                <th className={th}>izabrano</th>
                <th className={th}>rezervisano</th>
              </tr>
            </thead>
            <tbody>
              {r.map((x) => (
                <tr key={x.markupRuleId} className="border-t border-border">
                  <td className={td}>{x.ruleName ?? x.markupRuleId}</td>
                  <td className={td}>{x.avgMarginPct === null ? '–' : `${x.avgMarginPct}%`}</td>
                  <td className={td}>{x.shown}</td>
                  <td className={td}>
                    {x.chosen} <span className="text-ink-faint">({pct(x.chosen, x.shown)})</span>
                  </td>
                  <td className={td}>
                    {x.converted}{' '}
                    <span className="text-ink-faint">({pct(x.converted, x.shown)})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const r = rows as ShownNotChosenRow[];
  return (
    <div>
      {naslov}
      <p className="mb-2 text-xs text-ink-faint">
        Proizvod koji je često na vrhu a retko izabran ima problem cene ili prikaza — ovo je spisak
        za taj razgovor, ne presuda.
      </p>
      <div className="overflow-hidden overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-panel-2">
            <tr>
              <th className={th}>proizvod</th>
              <th className={th}>prikazano</th>
              <th className={th}>prosečna pozicija</th>
              <th className={th}>izabrano</th>
              <th className={th}>rezervisano</th>
            </tr>
          </thead>
          <tbody>
            {r.map((x) => (
              <tr
                key={x.productId}
                className={`border-t border-border ${x.shown >= 5 && x.chosen === 0 ? 'text-warn' : ''}`}
              >
                <td className={td}>{x.productName ?? x.productId}</td>
                <td className={td}>{x.shown}</td>
                <td className={td}>{x.avgRank}</td>
                <td className={td}>
                  {x.chosen} <span className="text-ink-faint">({pct(x.chosen, x.shown)})</span>
                </td>
                <td className={td}>{x.converted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
