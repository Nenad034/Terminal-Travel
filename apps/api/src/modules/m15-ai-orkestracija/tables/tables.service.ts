import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PermissionsService } from '../../m1-core-identitet/permissions/permissions.service';
import { BookingsService } from '../../m5-rezervacije/bookings/bookings.service';
import { ProductsService } from '../../m2-katalog-proizvoda/products/products.service';
import { FunnelService, FunnelDimension } from '../../m13-bi/reports/funnel.service';
import { WorkQueueService } from '../../m3-ugovaranje-alotmani/capacity/work-queue.service';
import { MAX_PAGE_SIZE } from '../../../common/pagination/pagination';
import {
  generateExcelBuffer,
  generateHtmlString,
  generatePdfBuffer,
  ReportData,
} from '../../../common/reports/report-generator';
import { saveReport } from '../../../common/reports/report-store';
import {
  MAX_TABLE_ROWS,
  TABLE_SOURCES,
  TableColumn,
  TableSpec,
  validateTableSpec,
} from './table-sources';

export type TableRow = Record<string, unknown> & { _key: string; _href?: string | null };

export interface TableResult {
  columns: TableColumn[];
  rows: TableRow[];
  rowCount: number;
  truncated: boolean;
  /** Isti upit za `spec.compare` period (M17 §6e.3f) — kod u pregledaču spaja po `_key`. */
  previous?: TableRow[];
}

/**
 * M17 §6e.3j — transformacije iz pregledača koje server PONOVO primeni pri izvozu. Nikad ne
 * prima gotove brojeve od klijenta (§6e.1 pravilo 1): filter i grupisanje se rade nad sveže
 * izvučenim redovima, istim kodom kao u pregledaču (`applyTransform`).
 */
export interface TableTransform {
  filters?: { column: string; op: 'contains' | 'gte' | 'lte' | 'eq' | 'neq'; value: string }[];
  sort?: { column: string; dir: 'asc' | 'desc' };
  groupBy?: string;
  hidden?: string[];
}

const DAN_MS = 86_400_000;

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const x = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(x.getTime()) ? null : x.toISOString().slice(0, 10);
}

function nights(from: unknown, to: unknown): number | null {
  const a = from instanceof Date ? from.getTime() : new Date(String(from)).getTime();
  const b = to instanceof Date ? to.getTime() : new Date(String(to)).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  return Math.round((b - a) / DAN_MS);
}

/** Čisto — deljeno sa testom; isti algoritam kao `applyTransform` u panelu (M17 §6e.3j). */
export function applyTransform(rows: TableRow[], t: TableTransform | undefined): TableRow[] {
  if (!t) return rows;
  let out = rows;
  for (const f of t.filters ?? []) {
    out = out.filter((r) => {
      const v = r[f.column];
      // M17 §6e.3 K2 (19.9.2026) — trakice: `eq`/`neq` porede sirovu vrednost kao string (novac u
      // parama, datum se svodi na `YYYY-MM-DD`), prazno (`''`) hvata null; `neq` je jedini op koji
      // PROPUŠTA red bez vrednosti (ako se ne traži baš „nije prazno").
      const day = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
      const s = v === null || v === undefined ? '' : (day ?? String(v));
      if (f.op === 'eq') return s === f.value;
      if (f.op === 'neq') return s !== f.value;
      if (v === null || v === undefined) return false;
      if (f.op === 'contains') return String(v).toLowerCase().includes(f.value.toLowerCase());
      if (day) return f.op === 'gte' ? day >= f.value : day <= f.value;
      const n = typeof v === 'number' ? v : Number(v);
      const cmp = Number.isNaN(n) ? String(v) : n;
      const target = Number.isNaN(n) ? f.value : Number(f.value);
      return f.op === 'gte' ? cmp >= target : cmp <= target;
    });
  }
  if (t.sort) {
    const { column, dir } = t.sort;
    out = [...out].sort((a, b) => {
      const x = a[column] as string | number | null;
      const y = b[column] as string | number | null;
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const c =
        typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return dir === 'asc' ? c : -c;
    });
  }
  if (t.groupBy) {
    const groups = new Map<string, TableRow[]>();
    for (const r of out) {
      const k = String(r[t.groupBy] ?? '(prazno)');
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    out = [...groups.entries()].flatMap(([k, list]) => {
      const zbir: TableRow = { _key: `zbir:${k}` };
      for (const c of Object.keys(list[0] ?? {})) {
        if (c.startsWith('_')) continue;
        const nums = list.map((r) => r[c]).filter((v): v is number => typeof v === 'number');
        zbir[c] =
          nums.length === list.length && nums.length > 0
            ? nums.reduce((a, b) => a + b, 0)
            : c === t.groupBy
              ? `${k} (${list.length})`
              : null;
      }
      return [...list, zbir];
    });
  }
  if (t.hidden?.length) {
    out = out.map((r) => {
      const c: TableRow = { _key: r._key, _href: r._href };
      for (const k of Object.keys(r)) if (!t.hidden!.includes(k) && !k.startsWith('_')) c[k] = r[k];
      return c;
    });
  }
  return out;
}

@Injectable()
export class TablesService {
  constructor(
    private readonly permissions: PermissionsService,
    private readonly bookings: BookingsService,
    private readonly products: ProductsService,
    private readonly funnel: FunnelService,
    private readonly workQueue: WorkQueueService,
  ) {}

  /** Dozvola izvora (i posebna za `funnel.by_markup_rule`) — programski, po `spec.source`. */
  async assertAllowed(spec: TableSpec, actorUserId: string): Promise<void> {
    const def = TABLE_SOURCES[spec.source];
    if (!def) throw new BadRequestException(`Nepoznat izvor "${spec.source}".`);
    const p = def.permission;
    const ok = await this.permissions.hasPermission(actorUserId, p.module, p.resource, p.action);
    if (!ok)
      throw new ForbiddenException(
        `Nemate dozvolu ${p.module}/${p.resource}/${p.action} za izvor "${spec.source}".`,
      );
    if (spec.source === 'funnel' && spec.filters?.dimension === 'by_markup_rule') {
      const okM = await this.permissions.hasPermission(
        actorUserId,
        'M13',
        'report:profitability',
        'VIEW',
      );
      if (!okM)
        throw new ForbiddenException('Marža po pravilu traži M13/report:profitability/VIEW.');
    }
  }

  async run(spec: TableSpec, actorUserId: string): Promise<TableResult> {
    const v = validateTableSpec(spec);
    if ('error' in v) throw new BadRequestException(v.error);
    await this.assertAllowed(spec, actorUserId);

    const { columns, rows } = await this.fetch(spec, actorUserId);
    const result: TableResult = {
      columns: spec.columns?.length
        ? columns.filter((c) => spec.columns!.includes(c.key))
        : columns,
      rows: rows.slice(0, MAX_TABLE_ROWS),
      rowCount: rows.length,
      truncated: rows.length > MAX_TABLE_ROWS,
    };
    if (spec.compare) {
      const def = TABLE_SOURCES[spec.source];
      const prev: TableSpec = {
        ...spec,
        compare: undefined,
        filters: {
          ...(spec.filters ?? {}),
          [def.periodFilter!.from]: spec.compare.from,
          [def.periodFilter!.to]: spec.compare.to,
        },
      };
      result.previous = (await this.fetch(prev, actorUserId)).rows.slice(0, MAX_TABLE_ROWS);
    }
    return result;
  }

  /** M17 §6e.3j — izvoz: sveže izvlačenje + iste transformacije, pa postojeći generator. */
  async export(
    spec: TableSpec,
    format: 'EXCEL' | 'PDF' | 'HTML',
    transform: TableTransform | undefined,
    actorUserId: string,
    scenarioLabel?: string,
  ): Promise<{ id: string; format: 'EXCEL' | 'PDF' | 'HTML'; fileName: string; rowCount: number }> {
    const res = await this.run(spec, actorUserId);
    const rows = applyTransform(res.rows, transform);
    const visible = res.columns.filter((c) => !transform?.hidden?.includes(c.key));
    const data: ReportData = {
      title: `${spec.title ?? TABLE_SOURCES[spec.source].label}${scenarioLabel ? ` — SCENARIO (${scenarioLabel})` : ''}`,
      rows: rows.map((r) => {
        const o: Record<string, unknown> = {};
        for (const c of visible) o[c.label] = r[c.key] ?? '';
        return o;
      }),
    };
    let buffer: Buffer;
    let mimeType: string;
    let extension: string;
    if (format === 'EXCEL') {
      buffer = await generateExcelBuffer(data);
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = 'xlsx';
    } else if (format === 'PDF') {
      buffer = await generatePdfBuffer(data);
      mimeType = 'application/pdf';
      extension = 'pdf';
    } else {
      buffer = Buffer.from(generateHtmlString(data), 'utf8');
      mimeType = 'text/html; charset=utf-8';
      extension = 'html';
    }
    const fileName = `${data.title.replace(/[^\p{L}\p{N}-]+/gu, '_')}.${extension}`;
    const id = saveReport({
      buffer,
      mimeType,
      fileName,
      createdBy: actorUserId,
      sourceAgent: 'OMNISEARCH',
    });
    return { id, format, fileName, rowCount: rows.length };
  }

  private async fetch(
    spec: TableSpec,
    actorUserId: string,
  ): Promise<{ columns: TableColumn[]; rows: TableRow[] }> {
    const def = TABLE_SOURCES[spec.source];
    const f = spec.filters ?? {};
    const one = (k: string) =>
      Array.isArray(f[k]) ? (f[k] as string[])[0] : (f[k] as string | undefined);
    const many = (k: string) =>
      f[k] === undefined ? undefined : Array.isArray(f[k]) ? (f[k] as string[]) : [f[k] as string];

    switch (spec.source) {
      case 'bookings': {
        // Straničenje je zaključano na MAX_PAGE_SIZE po strani — do MAX_TABLE_ROWS u više prolaza.
        const all: any[] = [];
        for (let page = 1; all.length < MAX_TABLE_ROWS + 1; page++) {
          const res = await this.bookings.findAll(
            {
              status: many('status'),
              paymentStatus: many('paymentStatus'),
              productType: many('productType'),
              channel: one('channel'),
              buyerName: one('buyerName'),
              bookingNumber: one('bookingNumber'),
              currency: one('currency'),
              destinationCity: one('destinationCity'),
              destinationCountry: one('destinationCountry'),
              productName: one('productName'),
              createdFrom: one('createdFrom'),
              createdTo: one('createdTo'),
              stayFrom: one('stayFrom'),
              stayTo: one('stayTo'),
            },
            { userId: actorUserId },
            { page, limit: MAX_PAGE_SIZE },
          );
          all.push(...(res.data as any[]));
          if (!res.hasMore) break;
        }
        // Nabavna/marža/neto samo kad je pozivalac interni — `findAll` već maskira stavke
        // (M5 §6.2), pa je `baseCost` ovde `undefined` za B2B/gost i kolone se izostavljaju.
        const internal = all.some((b) => b.items?.some((i: any) => i.baseCost !== undefined));
        const rows: TableRow[] = all.map((b) => {
          const items: any[] = b.items ?? [];
          const first = items[0];
          const prodajna = items.reduce((s, i) => s + (i.finalPrice ?? 0), 0);
          const nabavna = internal ? items.reduce((s, i) => s + (i.baseCost ?? 0), 0) : null;
          const marza = nabavna === null ? null : prodajna - nabavna;
          const row: TableRow = {
            _key: b.bookingNumber,
            _href: `/rezervacije/${b.id}`,
            broj: b.bookingNumber,
            kupac: b.buyerName,
            kanal: b.channel,
            status: b.status,
            uplata: b.paymentStatus,
            drzava: first?.product?.destinationCountry ?? null,
            mesto: first?.product?.destinationCity ?? null,
            proizvod: first?.product?.type ?? null,
            kreirano: iso(b.createdAt),
            dolazak: iso(first?.stayFrom),
            odlazak: iso(first?.stayTo),
            noci: first ? nights(first.stayFrom, first.stayTo) : null,
            valuta: first?.finalPriceCurrency ?? null,
            prodajna,
          };
          if (internal) {
            row.nabavna = nabavna;
            row.marza = marza;
            row.marza_pct = nabavna ? Math.round(((marza as number) / nabavna) * 1000) / 10 : null;
            row.provizija = 0;
            row.neto = marza;
          }
          return row;
        });
        return {
          columns: internal ? def.columns : def.columns.filter((c) => !c.internalOnly),
          rows,
        };
      }
      case 'catalog': {
        const res = await this.products.findAll(
          {
            type: one('type') as never,
            destinationCountry: one('destinationCountry'),
            status: one('status') as never,
          },
          { page: 1, limit: MAX_PAGE_SIZE },
        );
        const all: any[] = [...(res.data as any[])];
        for (
          let page = 2;
          res.hasMore && all.length < MAX_TABLE_ROWS + 1 && page <= res.pageCount;
          page++
        ) {
          const r = await this.products.findAll(
            {
              type: one('type') as never,
              destinationCountry: one('destinationCountry'),
              status: one('status') as never,
            },
            { page, limit: MAX_PAGE_SIZE },
          );
          all.push(...(r.data as any[]));
        }
        const rows: TableRow[] = all.map((p) => ({
          _key: p.id,
          _href: `/katalog/${p.id}`,
          naziv: p.translation?.name ?? p.id,
          vrsta: p.type,
          drzava: p.destinationCountry,
          mesto: p.destinationCity,
          zvezdice: p.attributes?.stars ?? null,
          status: p.status,
          izvor: p.sourceType,
          dobavljac: p.supplierName ?? null,
        }));
        return { columns: def.columns, rows };
      }
      case 'funnel': {
        const dimension = one('dimension') as FunnelDimension;
        const r: any = await this.funnel.funnel({ dimension, from: one('from'), to: one('to') });
        if (r.steps) {
          const columns: TableColumn[] = [
            { key: 'grupa', label: 'Grupa', type: 'text' },
            { key: 'upiti', label: 'Upiti', type: 'number' },
            { key: 'prikazano', label: 'Prikazano', type: 'number' },
            { key: 'ponude', label: 'Ponude', type: 'number' },
            { key: 'otvorene', label: 'Otvorene', type: 'number' },
            { key: 'rezervacije', label: 'Rezervacije', type: 'number' },
          ];
          return {
            columns,
            rows: r.steps.map((s: any) => ({
              _key: s.key,
              grupa: s.key,
              upiti: s.searches,
              prikazano: s.shown,
              ponude: s.quotes,
              otvorene: s.opened,
              rezervacije: s.converted,
            })),
          };
        }
        if (dimension === 'by_markup_rule') {
          const columns: TableColumn[] = [
            { key: 'pravilo', label: 'Pravilo marže', type: 'text' },
            { key: 'marza_pct', label: 'Prosečna marža %', type: 'percent' },
            { key: 'prikazano', label: 'Prikazano', type: 'number' },
            { key: 'izabrano', label: 'Izabrano', type: 'number' },
            { key: 'rezervisano', label: 'Rezervisano', type: 'number' },
          ];
          return {
            columns,
            rows: r.rows.map((x: any) => ({
              _key: x.markupRuleId,
              pravilo: x.ruleName ?? x.markupRuleId,
              marza_pct: x.avgMarginPct,
              prikazano: x.shown,
              izabrano: x.chosen,
              rezervisano: x.converted,
            })),
          };
        }
        const columns: TableColumn[] = [
          { key: 'proizvod', label: 'Proizvod', type: 'text' },
          { key: 'prikazano', label: 'Prikazano', type: 'number' },
          { key: 'pozicija', label: 'Prosečna pozicija', type: 'number' },
          { key: 'izabrano', label: 'Izabrano', type: 'number' },
          { key: 'rezervisano', label: 'Rezervisano', type: 'number' },
        ];
        return {
          columns,
          rows: r.rows.map((x: any) => ({
            _key: x.productId,
            _href: `/katalog/${x.productId}`,
            proizvod: x.productName ?? x.productId,
            prikazano: x.shown,
            pozicija: x.avgRank,
            izabrano: x.chosen,
            rezervisano: x.converted,
          })),
        };
      }
      case 'work_queue': {
        const { items } = await this.workQueue.build();
        const kinds = many('kind');
        const rows: TableRow[] = items
          .filter((i) => !kinds || kinds.includes(i.kind))
          .map((i, idx) => ({
            _key: `${i.kind}:${i.contractId}:${i.contractPeriodId ?? idx}:${i.date}`,
            _href: `/kapaciteti?contractId=${i.contractId}&from=${i.date}&to=${i.date}`,
            vrsta: i.kind,
            datum: i.date,
            objekat: i.productName,
            dobavljac: i.supplierName,
            drzava: i.destinationCountry,
            mesto: i.destinationCity,
            tip_sobe: i.roomType,
            detalj: i.detail,
            vrednost: i.value,
          }));
        return { columns: def.columns, rows };
      }
    }
  }
}
