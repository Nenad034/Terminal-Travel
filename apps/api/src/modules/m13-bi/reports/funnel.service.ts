import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * M13 spec §4.4a (19.9.2026) — lijevak od upita do rezervacije, nad M5 §3.0k zapisom.
 *
 * Pet stepenica: upit (`SearchLog`) → prikazano (upit sa ≥1 `SearchLogResult`) → ponuda
 * (`Quote.search_log_id`) → otvoreno (`Quote.shared_view_count > 0`) → rezervacija
 * (`Quote.status = CONVERTED`). Čita M5 tabele direktno, read-only (isti princip kao §4.4 —
 * M5 ostaje izvor istine, ništa ne ulazi u `FactBooking`).
 *
 * `by_markup_rule` nosi nabavnu cenu, pa ide iza `report:profitability` dozvole (kontroler),
 * ne iza `report:temporal` kao ostale dimenzije.
 */
export const FUNNEL_DIMENSIONS = [
  'by_destination',
  'by_channel',
  'by_lead_time',
  'shown_not_chosen',
  'by_markup_rule',
] as const;
export type FunnelDimension = (typeof FUNNEL_DIMENSIONS)[number];

/** Kategorije lead-time-a — iste granice kao §4.4 (kategorije, ne prosek). */
export const LEAD_TIME_BUCKETS = [
  '<7 dana',
  '7–30 dana',
  '31–90 dana',
  '90+ dana',
  'nepoznato',
] as const;

export function leadTimeBucket(days: number | null): (typeof LEAD_TIME_BUCKETS)[number] {
  if (days === null || days === undefined) return 'nepoznato';
  if (days < 7) return '<7 dana';
  if (days <= 30) return '7–30 dana';
  if (days <= 90) return '31–90 dana';
  return '90+ dana';
}

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
  /** prosečna marža u procentima nad nabavnom, iz prikazanih ponuda; null kad nema nabavne */
  avgMarginPct: number | null;
}

type LogRow = {
  id: string;
  channel: string;
  destinationCountry: string | null;
  destinationCity: string | null;
  leadTimeDays: number | null;
  results: {
    productId: string;
    rank: number;
    offerFinalPrice: number;
    offerBaseCost: number | null;
    markupRuleId: string | null;
  }[];
};

type QuoteRow = {
  searchLogId: string | null;
  status: string;
  sharedViewCount: number;
  items: { productId: string; markupRuleId: string | null }[];
};

@Injectable()
export class FunnelService {
  constructor(private readonly prisma: PrismaService) {}

  async funnel(filters: { dimension: FunnelDimension; from?: string; to?: string }) {
    const range = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
    };
    const logs: LogRow[] = await this.prisma.searchLog.findMany({
      where: Object.keys(range).length ? { occurredAt: range } : {},
      select: {
        id: true,
        channel: true,
        destinationCountry: true,
        destinationCity: true,
        leadTimeDays: true,
        results: {
          select: {
            productId: true,
            rank: true,
            offerFinalPrice: true,
            offerBaseCost: true,
            markupRuleId: true,
          },
        },
      },
    });
    const ids = logs.map((l) => l.id);
    const quotes: QuoteRow[] = ids.length
      ? await this.prisma.quote.findMany({
          where: { searchLogId: { in: ids } },
          select: {
            searchLogId: true,
            status: true,
            sharedViewCount: true,
            items: { select: { productId: true, markupRuleId: true } },
          },
        })
      : [];
    const quotesByLog = new Map<string, QuoteRow[]>();
    for (const q of quotes) {
      if (!q.searchLogId) continue;
      const lista = quotesByLog.get(q.searchLogId) ?? [];
      lista.push(q);
      quotesByLog.set(q.searchLogId, lista);
    }

    switch (filters.dimension) {
      case 'by_destination':
        return {
          steps: this.steps(logs, quotesByLog, (l) =>
            l.destinationCountry || l.destinationCity
              ? `${l.destinationCountry ?? '(nepoznato)'} / ${l.destinationCity ?? '(nepoznato)'}`
              : '(bez destinacije u upitu)',
          ),
        };
      case 'by_channel':
        return { steps: this.steps(logs, quotesByLog, (l) => l.channel) };
      case 'by_lead_time':
        return {
          steps: this.steps(logs, quotesByLog, (l) => leadTimeBucket(l.leadTimeDays)).sort(
            (a, b) =>
              LEAD_TIME_BUCKETS.indexOf(a.key as never) - LEAD_TIME_BUCKETS.indexOf(b.key as never),
          ),
        };
      case 'shown_not_chosen':
        return { rows: await this.shownNotChosen(logs, quotesByLog) };
      case 'by_markup_rule':
        return { rows: await this.byMarkupRule(logs, quotesByLog) };
    }
  }

  private steps(
    logs: LogRow[],
    quotesByLog: Map<string, QuoteRow[]>,
    keyOf: (l: LogRow) => string,
  ): FunnelStep[] {
    const map = new Map<string, FunnelStep>();
    for (const l of logs) {
      const key = keyOf(l);
      const s = map.get(key) ?? { key, searches: 0, shown: 0, quotes: 0, opened: 0, converted: 0 };
      s.searches++;
      if (l.results.length > 0) s.shown++;
      const qs = quotesByLog.get(l.id) ?? [];
      if (qs.length > 0) s.quotes++;
      if (qs.some((q) => q.sharedViewCount > 0)) s.opened++;
      if (qs.some((q) => q.status === 'CONVERTED')) s.converted++;
      map.set(key, s);
    }
    return [...map.values()].sort((a, b) => b.searches - a.searches);
  }

  /** Proizvod koji je 200 puta viđen na 1. mestu i nijednom izabran ima problem cene ili prikaza. */
  private async shownNotChosen(
    logs: LogRow[],
    quotesByLog: Map<string, QuoteRow[]>,
  ): Promise<ShownNotChosenRow[]> {
    const acc = new Map<
      string,
      { shown: number; rankSum: number; chosen: number; converted: number }
    >();
    for (const l of logs) {
      const qs = quotesByLog.get(l.id) ?? [];
      for (const r of l.results) {
        const a = acc.get(r.productId) ?? { shown: 0, rankSum: 0, chosen: 0, converted: 0 };
        a.shown++;
        a.rankSum += r.rank;
        const izabran = qs.filter((q) => q.items.some((i) => i.productId === r.productId));
        if (izabran.length > 0) a.chosen++;
        if (izabran.some((q) => q.status === 'CONVERTED')) a.converted++;
        acc.set(r.productId, a);
      }
    }
    const ids = [...acc.keys()];
    const imena = ids.length
      ? await this.prisma.productTranslation.findMany({
          where: { productId: { in: ids }, languageCode: 'sr' },
          select: { productId: true, name: true },
        })
      : [];
    const imePoId = new Map(imena.map((t) => [t.productId, t.name]));
    return ids
      .map((productId) => {
        const a = acc.get(productId)!;
        return {
          productId,
          productName: imePoId.get(productId) ?? null,
          shown: a.shown,
          avgRank: Math.round((a.rankSum / a.shown) * 10) / 10,
          chosen: a.chosen,
          converted: a.converted,
        };
      })
      .sort((x, y) => y.shown - x.shown);
  }

  /** Samo interno (`report:profitability`) — nosi nabavnu cenu. */
  private async byMarkupRule(
    logs: LogRow[],
    quotesByLog: Map<string, QuoteRow[]>,
  ): Promise<MarkupRuleRow[]> {
    const acc = new Map<
      string,
      { shown: number; chosen: number; converted: number; marginSum: number; marginN: number }
    >();
    for (const l of logs) {
      const qs = quotesByLog.get(l.id) ?? [];
      for (const r of l.results) {
        if (!r.markupRuleId) continue;
        const a = acc.get(r.markupRuleId) ?? {
          shown: 0,
          chosen: 0,
          converted: 0,
          marginSum: 0,
          marginN: 0,
        };
        a.shown++;
        if (r.offerBaseCost && r.offerBaseCost > 0) {
          a.marginSum += ((r.offerFinalPrice - r.offerBaseCost) / r.offerBaseCost) * 100;
          a.marginN++;
        }
        // „Izabrano" je po PRIKAZANOJ ponudi: isti proizvod pod istim pravilom — ne bilo koja
        // stavka sa tim pravilom (inače bi svaki prikaz pod pravilom X brojao jednu tuđu ponudu).
        const izabran = qs.filter((q) =>
          q.items.some((i) => i.productId === r.productId && i.markupRuleId === r.markupRuleId),
        );
        if (izabran.length > 0) a.chosen++;
        if (izabran.some((q) => q.status === 'CONVERTED')) a.converted++;
        acc.set(r.markupRuleId, a);
      }
    }
    const ids = [...acc.keys()];
    const pravila = ids.length
      ? await this.prisma.markupRule.findMany({
          where: { id: { in: ids } },
          select: { id: true, scopeType: true, percentage: true, fixedAmount: true },
        })
      : [];
    // `MarkupRule` nema naziv (M5 §2.1) — čitljiva oznaka iz opsega i vrednosti.
    const imePoId = new Map(
      pravila.map((p) => [
        p.id,
        `${p.scopeType} · ${p.percentage !== null ? `${Number(p.percentage)}%` : `${p.fixedAmount ?? 0} fiksno`}`,
      ]),
    );
    return ids
      .map((markupRuleId) => {
        const a = acc.get(markupRuleId)!;
        return {
          markupRuleId,
          ruleName: imePoId.get(markupRuleId) ?? null,
          shown: a.shown,
          chosen: a.chosen,
          converted: a.converted,
          avgMarginPct: a.marginN ? Math.round((a.marginSum / a.marginN) * 10) / 10 : null,
        };
      })
      .sort((x, y) => y.shown - x.shown);
  }
}
