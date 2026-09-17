import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CapacityGridRow, CapacityService, isoDay, startOfDay } from './capacity.service';

const MS_DAY = 24 * 60 * 60 * 1000;

/** `2026-09-15` → `15.9.2026.` — opis reda čita čovek, ne mašina. */
function sr(d: Date | string): string {
  const iso = typeof d === 'string' ? d : isoDay(d);
  const [y, m, dd] = iso.split('-').map(Number);
  return `${dd}.${m}.${y}.`;
}

/**
 * M3 spec §6 `GET /capacity/work-queue` / M17 §4b.0 (stanje 1) — radni spisak: samo ono što
 * traži pažnju danas. Prozori (v1.45, 17.9.2026 — spec ih je imenovao, ne i brojčano zadao):
 */
export const WORK_QUEUE_WINDOWS = {
  /** Prekoračen kapacitet (`razlika < 0`) — gleda se kvartal unapred, koliko i mreža sme odjednom. */
  OVERBOOKED_DAYS: 92,
  /** Tipovi soba sa 0–2 preostale jedinice (M17 §4b.0: „u narednih 30 dana"). */
  LOW_UNITS_DAYS: 30,
  LOW_UNITS_MAX: 2,
  /** Blokade kojima ističe rok — isti prag kao događaj `capacity_block.expiring` (§2.8b: 2 dana). */
  BLOCK_EXPIRING_DAYS: 2,
  /** Stop-sale čiji poslednji zatvoren dan pada u naredna 2 dana — prodaja se „sutra otvara". */
  STOP_SALE_ENDING_DAYS: 2,
  /** Rok povrata (`stay_from − release_days_before`, samo FIXED) u narednih 7 dana. */
  RELEASE_DUE_DAYS: 7,
} as const;

export type WorkQueueKind =
  | 'OVERBOOKED'
  | 'BLOCK_EXPIRING'
  | 'STOP_SALE_ENDING'
  | 'RELEASE_DUE'
  | 'LOW_UNITS'
  | 'OFFER_EXPIRING';

export interface WorkQueueItem {
  kind: WorkQueueKind;
  /** Datum koji red čini hitnim (ISO dan) — po njemu se sortira. */
  date: string;
  contractId: string;
  contractPeriodId: string | null;
  productName: string | null;
  supplierName: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  roomType: string | null;
  /** Čitljiv opis za red („prodato 12 od 10", „blokada 4 sobe ističe 19.9.", „−15 %"). */
  detail: string;
  /** Broj koji red nosi (prekoračenje, preostale jedinice, dani) — za sortiranje unutar vrste. */
  value: number | null;
  /** Samo `OFFER_EXPIRING` — id `OfferExpiryNotice` za „video". */
  noticeId: string | null;
}

@Injectable()
export class WorkQueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacity: CapacityService,
  ) {}

  async build(today: Date = new Date()): Promise<{ generatedFor: string; items: WorkQueueItem[] }> {
    const day0 = startOfDay(today);
    const horizon = new Date(day0.getTime() + (WORK_QUEUE_WINDOWS.OVERBOOKED_DAYS - 1) * MS_DAY);
    const grid = await this.capacity.grid({ from: isoDay(day0), to: isoDay(horizon) });

    const items: WorkQueueItem[] = [
      ...this.fromGrid(grid.rows, day0),
      ...(await this.expiringBlocks(day0)),
      ...(await this.releaseDeadlines(day0)),
      ...(await this.expiringOffers()),
    ];
    items.sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind.localeCompare(b.kind),
    );
    return { generatedFor: isoDay(day0), items };
  }

  /** Prekoračenja, stop-sale koji se otvara i 0–2 jedinice — sve iz jednog čitanja mreže. */
  private fromGrid(rows: CapacityGridRow[], day0: Date): WorkQueueItem[] {
    const out: WorkQueueItem[] = [];
    const lowUntil = isoDay(
      new Date(day0.getTime() + (WORK_QUEUE_WINDOWS.LOW_UNITS_DAYS - 1) * MS_DAY),
    );
    const stopUntil = isoDay(
      new Date(day0.getTime() + (WORK_QUEUE_WINDOWS.STOP_SALE_ENDING_DAYS - 1) * MS_DAY),
    );
    for (const row of rows) {
      const base = {
        contractId: row.contractId,
        contractPeriodId: row.contractPeriodId,
        productName: row.productName,
        supplierName: row.supplierName,
        destinationCity: row.destinationCity,
        destinationCountry: row.destinationCountry,
        roomType: row.roomType,
        noticeId: null,
      };
      const inPeriod = row.days.filter((d) => d.capacity !== null);

      // Prekoračenje — prvi dan sa negativnom razlikom, najgori broj.
      const over = inPeriod.filter((d) => d.razlika !== null && d.razlika < 0);
      if (over.length > 0) {
        const worst = Math.min(...over.map((d) => d.razlika as number));
        out.push({
          ...base,
          kind: 'OVERBOOKED',
          date: over[0].date,
          detail: `prodato ${over[0].sold} od ${over[0].capacity} (${over.length} ${over.length === 1 ? 'dan' : 'dana'}, najviše ${-worst} preko)`,
          value: -worst,
        });
      }

      // Stop-sale koji se otvara: zatvoren dan posle kog dolazi otvoren, unutar prozora.
      for (let i = 0; i < inPeriod.length; i++) {
        const d = inPeriod[i];
        if (d.saleStatus !== 'STOP' || d.date > stopUntil) continue;
        const next = inPeriod[i + 1];
        if (next && next.saleStatus === 'STOP') continue;
        out.push({
          ...base,
          kind: 'STOP_SALE_ENDING',
          date: d.date,
          detail: `prodaja zatvorena do ${sr(d.date)}${d.stopReason ? ` (${d.stopReason})` : ''}, od sutra otvorena`,
          value: null,
        });
        break;
      }

      // 0–2 preostale jedinice u narednih 30 dana (samo otvoreni dani sa kapacitetom).
      const low = inPeriod.filter(
        (d) =>
          d.date <= lowUntil &&
          d.saleStatus === 'OPEN' &&
          d.razlika !== null &&
          d.razlika >= 0 &&
          d.zaProdaju <= WORK_QUEUE_WINDOWS.LOW_UNITS_MAX,
      );
      if (low.length > 0 && row.allotmentMode !== 'ON_REQUEST') {
        const min = Math.min(...low.map((d) => d.zaProdaju));
        out.push({
          ...base,
          kind: 'LOW_UNITS',
          date: low[0].date,
          detail: `još ${min} ${min === 1 ? 'jedinica' : 'jedinice'} (${low.length} ${low.length === 1 ? 'dan' : 'dana'} u narednih ${WORK_QUEUE_WINDOWS.LOW_UNITS_DAYS})`,
          value: min,
        });
      }
    }
    return out;
  }

  private async expiringBlocks(day0: Date): Promise<WorkQueueItem[]> {
    const until = new Date(day0.getTime() + WORK_QUEUE_WINDOWS.BLOCK_EXPIRING_DAYS * MS_DAY);
    const blocks = await this.prisma.capacityBlock.findMany({
      where: { status: 'ACTIVE', holdUntil: { lte: until } },
      include: { contractPeriod: { include: { contract: { include: { supplier: true } } } } },
      orderBy: { holdUntil: 'asc' },
    });
    const products = await this.productsFor(blocks.map((b) => b.contractPeriod.contractId));
    return blocks.map((b) => {
      const p = products.get(b.contractPeriod.contractId);
      return {
        kind: 'BLOCK_EXPIRING' as const,
        date: isoDay(b.holdUntil),
        contractId: b.contractPeriod.contractId,
        contractPeriodId: b.contractPeriodId,
        productName: p?.name ?? null,
        supplierName: b.contractPeriod.contract.supplier.name,
        destinationCity: p?.destinationCity ?? null,
        destinationCountry: p?.destinationCountry ?? null,
        roomType: b.contractPeriod.roomType,
        detail: `blokada ${b.units} ${b.units === 1 ? 'jedinica' : 'jedinice'} (${b.reason}) ${b.holdUntil < new Date() ? 'istekla' : 'ističe'} ${sr(b.holdUntil)} — potvrdi grupu ili pusti`,
        value: b.units,
        noticeId: null,
      };
    });
  }

  /** Rok povrata: FIXED period čiji `stay_from − release_days_before` pada u naredna 7 dana. */
  private async releaseDeadlines(day0: Date): Promise<WorkQueueItem[]> {
    const periods = await this.prisma.contractPeriod.findMany({
      where: {
        status: 'ACTIVE',
        allotmentMode: 'FIXED',
        releaseDaysBefore: { not: null },
        stayFrom: { gte: day0 },
        contract: { status: 'ACTIVE' },
      },
      include: { contract: { include: { supplier: true } } },
    });
    const until = new Date(day0.getTime() + WORK_QUEUE_WINDOWS.RELEASE_DUE_DAYS * MS_DAY);
    const due = periods
      .map((p) => ({
        p,
        deadline: new Date(
          startOfDay(p.stayFrom).getTime() - (p.releaseDaysBefore as number) * MS_DAY,
        ),
      }))
      .filter(({ deadline }) => deadline >= day0 && deadline <= until);
    const products = await this.productsFor(due.map(({ p }) => p.contractId));
    return due.map(({ p, deadline }) => {
      const prod = products.get(p.contractId);
      const preostalo = p.totalCapacity === null ? null : p.totalCapacity - p.unitsSold;
      return {
        kind: 'RELEASE_DUE' as const,
        date: isoDay(deadline),
        contractId: p.contractId,
        contractPeriodId: p.id,
        productName: prod?.name ?? null,
        supplierName: p.contract.supplier.name,
        destinationCity: prod?.destinationCity ?? null,
        destinationCountry: prod?.destinationCountry ?? null,
        roomType: p.roomType,
        detail: `rok povrata ${sr(deadline)} (${p.releaseDaysBefore} dana pre ${sr(p.stayFrom)})${preostalo !== null ? ` — neprodato ${preostalo} od ${p.totalCapacity}` : ''}`,
        value: preostalo,
        noticeId: null,
      };
    });
  }

  /** §4.9 — `INTERNAL` prag, još nepotvrđene. */
  private async expiringOffers(): Promise<WorkQueueItem[]> {
    const notices = await this.prisma.offerExpiryNotice.findMany({
      where: { threshold: 'INTERNAL', acknowledgedAt: null },
      orderBy: { bookingTo: 'asc' },
    });
    const KIND: Record<string, string> = {
      EARLY_BOOKING: 'rani buking',
      FREE_NIGHTS: 'gratis noći',
      DISCOUNT: 'popust',
      FIRST_TRANCHE: 'cena prve tranše',
    };
    return notices.map((n) => ({
      kind: 'OFFER_EXPIRING' as const,
      date: isoDay(n.bookingTo),
      contractId: n.contractId,
      contractPeriodId: n.contractPeriodId,
      productName: n.productName,
      supplierName: null,
      destinationCity: n.destinationCity,
      destinationCountry: n.destinationCountry,
      roomType: null,
      detail: `${KIND[n.offerKind] ?? n.offerKind} ${n.discountSummary}${n.stayFrom && n.stayTo ? `, boravak ${sr(n.stayFrom)}–${sr(n.stayTo)}` : ''}, ističe ${sr(n.bookingTo)}`,
      value: null,
      noticeId: n.id,
    }));
  }

  private async productsFor(contractIds: string[]) {
    const ids = [...new Set(contractIds)];
    if (ids.length === 0)
      return new Map<
        string,
        { name: string | null; destinationCity: string | null; destinationCountry: string | null }
      >();
    const products = await this.prisma.product.findMany({
      where: { sourceContractId: { in: ids } },
      select: {
        sourceContractId: true,
        destinationCountry: true,
        destinationCity: true,
        translations: { where: { languageCode: 'sr' }, select: { name: true }, take: 1 },
      },
    });
    return new Map(
      products.map((p) => [
        p.sourceContractId as string,
        {
          name: p.translations[0]?.name ?? null,
          destinationCity: p.destinationCity,
          destinationCountry: p.destinationCountry,
        },
      ]),
    );
  }
}
