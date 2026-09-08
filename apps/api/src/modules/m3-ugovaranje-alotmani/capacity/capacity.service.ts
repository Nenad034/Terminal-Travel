import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CapacityStopSource, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { EventBusService } from '../../../common/events/event-bus.service';
import { CapacityGridQueryDto } from './dto/capacity-grid-query.dto';
import { SetStopSaleDto } from './dto/set-stop-sale.dto';
import { SetCapacityOverrideDto } from './dto/set-capacity-override.dto';
import { CreateCapacityBlockDto } from './dto/create-capacity-block.dto';

/**
 * M3 spec §2.8 — kapacitet po danu, zatvaranje prodaje i blokade.
 *
 * Jedno pravilo koje objašnjava ceo servis: PRODATO SE NIGDE NE UPISUJE. Kapacitet,
 * stop-sale i blokade su autorski podaci (neko ih je svesno uneo) i oni se čuvaju; broj
 * prodatih jedinica za neku noć se uvek RAČUNA iz M5 rezervacija, jer je rezervacija izvor
 * istine, a isti broj vođen na dva mesta se pre ili kasnije razidje.
 */

/** Jedan dan jednog perioda, onako kako ga vidi mreža (§2.8c). */
export interface CapacityDayState {
  date: string;
  capacity: number | null;
  sold: number;
  blocked: number;
  /** Prikaz — SME biti negativan kad je kapacitet smanjen ispod prodatog (§2.8c). */
  razlika: number | null;
  /** Odluka o prodaji — nikad negativna, i 0 kad je prodaja zatvorena. */
  zaProdaju: number;
  saleStatus: 'OPEN' | 'STOP';
  stopReason: string | null;
}

export interface CapacityGridRow {
  contractId: string;
  contractPeriodId: string;
  supplierName: string;
  productName: string | null;
  destinationCountry: string | null;
  destinationCity: string | null;
  roomType: string;
  allotmentMode: string;
  days: CapacityDayState[];
}

const MS_DAY = 24 * 60 * 60 * 1000;

/** Niz kalendarskih dana (UTC ponoć) od `from` do `to`, uključivo. */
export function enumerateDays(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  for (let t = startOfDay(from).getTime(); t <= startOfDay(to).getTime(); t += MS_DAY) {
    days.push(new Date(t));
  }
  return days;
}

export function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isoDay(d: Date): string {
  return startOfDay(d).toISOString().slice(0, 10);
}

@Injectable()
export class CapacityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly eventBus: EventBusService,
  ) {}

  // ── Mreža ────────────────────────────────────────────────────────────────

  async grid(
    query: CapacityGridQueryDto,
  ): Promise<{ from: string; to: string; rows: CapacityGridRow[] }> {
    const from = startOfDay(new Date(query.from));
    const to = startOfDay(new Date(query.to));
    if (to < from) throw new BadRequestException('Datum „do" je pre datuma „od"');
    if ((to.getTime() - from.getTime()) / MS_DAY > 92) {
      throw new BadRequestException('Raspon je ograničen na 92 dana (jedan kvartal)');
    }

    const periods = await this.prisma.contractPeriod.findMany({
      where: {
        status: 'ACTIVE',
        stayFrom: { lte: to },
        stayTo: { gte: from },
        contractId: query.contractId,
        roomType: query.roomType,
        allotmentMode: query.allotmentMode,
        contract: {
          supplierId: query.supplierId,
          status: query.includeDraftContracts ? undefined : 'ACTIVE',
        },
      },
      include: {
        contract: { include: { supplier: { select: { name: true } } } },
        capacityDays: { where: { date: { gte: from, lte: to } } },
        capacityBlocks: {
          where: { status: 'ACTIVE', dateFrom: { lte: to }, dateTo: { gte: from } },
        },
      },
      orderBy: [{ contractId: 'asc' }, { roomType: 'asc' }],
    });

    if (periods.length === 0) return { from: isoDay(from), to: isoDay(to), rows: [] };

    // Prodato po danu — jedan upit za sve periode, pa raspodela po noćima u memoriji.
    // Stavka pokriva noći [stayFrom, stayTo) — noć koja počinje na dan odlaska se ne broji.
    const items = await this.prisma.bookingItem.findMany({
      where: {
        rateLine: { contractPeriodId: { in: periods.map((p) => p.id) } },
        itemStatus: { in: ['CONFIRMED', 'PENDING_SUPPLIER_CONFIRMATION'] },
        stayFrom: { lt: new Date(to.getTime() + MS_DAY) },
        stayTo: { gt: from },
      },
      select: {
        unitCount: true,
        stayFrom: true,
        stayTo: true,
        rateLine: { select: { contractPeriodId: true } },
      },
    });

    const soldByPeriodDay = new Map<string, number>();
    for (const item of items) {
      const periodId = item.rateLine?.contractPeriodId;
      if (!periodId) continue;
      for (const day of enumerateDays(item.stayFrom, new Date(item.stayTo.getTime() - MS_DAY))) {
        const key = `${periodId}|${isoDay(day)}`;
        soldByPeriodDay.set(key, (soldByPeriodDay.get(key) ?? 0) + item.unitCount);
      }
    }

    // Naziv proizvoda/destinacija — M2 se čita preko svog modela, bez dupliranja podatka.
    const products = await this.prisma.product.findMany({
      where: { sourceContractId: { in: periods.map((p) => p.contractId) } },
      select: {
        sourceContractId: true,
        destinationCountry: true,
        destinationCity: true,
        translations: { where: { languageCode: 'sr' }, select: { name: true }, take: 1 },
      },
    });
    const productByContract = new Map(products.map((p) => [p.sourceContractId ?? '', p]));

    const rows: CapacityGridRow[] = periods.map((period) => {
      const dayRows = new Map(period.capacityDays.map((d) => [isoDay(d.date), d]));
      const product = productByContract.get(period.contractId);

      const days = enumerateDays(from, to).map((day): CapacityDayState => {
        const key = isoDay(day);
        const inPeriod = day >= startOfDay(period.stayFrom) && day < startOfDay(period.stayTo);
        if (!inPeriod) {
          return {
            date: key,
            capacity: null,
            sold: 0,
            blocked: 0,
            razlika: null,
            zaProdaju: 0,
            saleStatus: 'OPEN',
            stopReason: null,
          };
        }
        const override = dayRows.get(key);
        const capacity = override?.capacityOverride ?? period.totalCapacity;
        const sold = soldByPeriodDay.get(`${period.id}|${key}`) ?? 0;
        const blocked = period.capacityBlocks
          .filter((b) => isoDay(b.dateFrom) <= key && key <= isoDay(b.dateTo))
          .reduce((sum, b) => sum + b.units, 0);
        const stopped = override?.saleStatus === 'STOP';
        const razlika = capacity === null ? null : capacity - sold - blocked;
        return {
          date: key,
          capacity,
          sold,
          blocked,
          razlika,
          zaProdaju: stopped || razlika === null ? 0 : Math.max(0, razlika),
          saleStatus: stopped ? 'STOP' : 'OPEN',
          stopReason: override?.stopReason ?? null,
        };
      });

      return {
        contractId: period.contractId,
        contractPeriodId: period.id,
        supplierName: period.contract.supplier.name,
        productName: product?.translations[0]?.name ?? null,
        destinationCountry: product?.destinationCountry ?? null,
        destinationCity: product?.destinationCity ?? null,
        roomType: period.roomType,
        allotmentMode: period.allotmentMode,
        days,
      };
    });

    return { from: isoDay(from), to: isoDay(to), rows };
  }

  // ── Stop-sale ────────────────────────────────────────────────────────────

  /**
   * §2.8a — dve nezavisne dimenzije obima: ŠTA (jedan period ili svi periodi ugovora) ×
   * KADA (jedan datum, raspon, ili ceo period). Sve kombinacije se svode na isti dnevni
   * zapis; "zatvori sve do kraja sezone" je masovni unos, ne poseban tip zapisa.
   */
  async setStopSale(dto: SetStopSaleDto, actorId: string, open = false) {
    const periods = await this.resolvePeriods(dto.contractId, dto.contractPeriodId);
    const from = startOfDay(new Date(dto.dateFrom));
    const to = startOfDay(new Date(dto.dateTo));
    if (to < from) throw new BadRequestException('Datum „do" je pre datuma „od"');

    let touched = 0;
    for (const period of periods) {
      for (const day of enumerateDays(from, to)) {
        if (day < startOfDay(period.stayFrom) || day >= startOfDay(period.stayTo)) continue;
        await this.prisma.capacityDay.upsert({
          where: { contractPeriodId_date: { contractPeriodId: period.id, date: day } },
          create: {
            contractPeriodId: period.id,
            date: day,
            saleStatus: open ? 'OPEN' : 'STOP',
            stopReason: open ? null : dto.reason,
            stopSource: open ? null : (dto.source as CapacityStopSource),
            stopSetBy: actorId,
            stopSetAt: new Date(),
          },
          update: {
            saleStatus: open ? 'OPEN' : 'STOP',
            stopReason: open ? null : dto.reason,
            stopSource: open ? null : (dto.source as CapacityStopSource),
            stopSetBy: actorId,
            stopSetAt: new Date(),
          },
        });
        touched += 1;
      }
    }

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: open ? 'capacity.sale_reopened' : 'capacity.sale_stopped',
      resourceType: 'ContractPeriod',
      resourceId: dto.contractPeriodId ?? dto.contractId ?? 'bulk',
      afterState: { touched, from: isoDay(from), to: isoDay(to) },
      context: { reason: dto.reason, source: dto.source, periods: periods.length },
    });

    return { periods: periods.length, days: touched };
  }

  // ── Kapacitet po danu ────────────────────────────────────────────────────

  /** §2.8a — `capacity_override` za raspon; `null` vraća dan na kapacitet perioda. */
  async setCapacityOverride(dto: SetCapacityOverrideDto, actorId: string) {
    const period = await this.prisma.contractPeriod.findUnique({
      where: { id: dto.contractPeriodId },
    });
    if (!period) throw new NotFoundException('Period nije pronađen');

    const from = startOfDay(new Date(dto.dateFrom));
    const to = startOfDay(new Date(dto.dateTo));
    if (to < from) throw new BadRequestException('Datum „do" je pre datuma „od"');

    let touched = 0;
    for (const day of enumerateDays(from, to)) {
      if (day < startOfDay(period.stayFrom) || day >= startOfDay(period.stayTo)) continue;
      await this.prisma.capacityDay.upsert({
        where: { contractPeriodId_date: { contractPeriodId: period.id, date: day } },
        create: { contractPeriodId: period.id, date: day, capacityOverride: dto.capacity },
        update: { capacityOverride: dto.capacity },
      });
      touched += 1;
    }

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'capacity.day_override_set',
      resourceType: 'ContractPeriod',
      resourceId: period.id,
      afterState: { capacity: dto.capacity, from: isoDay(from), to: isoDay(to), touched },
    });

    return { days: touched };
  }

  // ── Blokade ──────────────────────────────────────────────────────────────

  /** §2.8b — `reason` i `holdUntil` su obavezni; DTO to sprovodi, ovde se samo upisuje. */
  async createBlock(dto: CreateCapacityBlockDto, actorId: string) {
    const period = await this.prisma.contractPeriod.findUnique({
      where: { id: dto.contractPeriodId },
    });
    if (!period) throw new NotFoundException('Period nije pronađen');

    const dateFrom = startOfDay(new Date(dto.dateFrom));
    const dateTo = startOfDay(new Date(dto.dateTo));
    if (dateTo < dateFrom) throw new BadRequestException('Datum „do" je pre datuma „od"');

    const holdUntil = new Date(dto.holdUntil);
    if (holdUntil.getTime() <= Date.now()) {
      throw new BadRequestException('Rok blokade mora biti u budućnosti (M3 spec §2.8b)');
    }

    const block = await this.prisma.capacityBlock.create({
      data: {
        contractPeriodId: period.id,
        dateFrom,
        dateTo,
        units: dto.units,
        reason: dto.reason,
        holdUntil,
        createdBy: actorId,
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'capacity_block.created',
      resourceType: 'CapacityBlock',
      resourceId: block.id,
      afterState: block,
    });

    return block;
  }

  listBlocks(contractPeriodId: string) {
    return this.prisma.capacityBlock.findMany({
      where: { contractPeriodId },
      orderBy: { dateFrom: 'asc' },
    });
  }

  async releaseBlock(blockId: string, actorId: string, bookingId?: string) {
    const block = await this.prisma.capacityBlock.findUnique({ where: { id: blockId } });
    if (!block) throw new NotFoundException('Blokada nije pronađena');

    const updated = await this.prisma.capacityBlock.update({
      where: { id: blockId },
      data: {
        status: bookingId ? 'CONVERTED' : 'RELEASED',
        convertedBookingId: bookingId,
        releasedBy: actorId,
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: bookingId ? 'capacity_block.converted' : 'capacity_block.released',
      resourceType: 'CapacityBlock',
      resourceId: blockId,
      beforeState: block,
      afterState: updated,
    });

    return updated;
  }

  /**
   * §2.8b — blokade kojima je istekao rok same se vraćaju u prodaju, a dva dana pre isteka
   * emituje se `capacity_block.expiring` (M18 signal `CAPACITY_BLOCK_EXPIRING`). Poziva se iz
   * zakazanog posla; izdvojeno u metodu da bude testabilno bez čekanja na raspored.
   */
  async releaseExpiredBlocks(): Promise<{ released: number; expiring: number }> {
    const now = new Date();
    const expired = await this.prisma.capacityBlock.findMany({
      where: { status: 'ACTIVE', holdUntil: { lte: now } },
    });
    for (const block of expired) {
      await this.prisma.capacityBlock.update({
        where: { id: block.id },
        data: { status: 'RELEASED' },
      });
      await this.auditLog.write({
        actorType: 'SYSTEM',
        module: 'M3',
        action: 'capacity_block.auto_released',
        resourceType: 'CapacityBlock',
        resourceId: block.id,
        beforeState: block,
        context: { reason: 'istekao hold_until' },
      });
    }

    const soon = new Date(now.getTime() + 2 * MS_DAY);
    const expiring = await this.prisma.capacityBlock.findMany({
      where: { status: 'ACTIVE', holdUntil: { gt: now, lte: soon } },
    });
    for (const block of expiring) {
      await this.eventBus.emit('M3', 'capacity_block_expiring', {
        blockId: block.id,
        contractPeriodId: block.contractPeriodId,
        holdUntil: block.holdUntil,
        units: block.units,
        reason: block.reason,
        severity: 'WARNING',
      });
    }

    return { released: expired.length, expiring: expiring.length };
  }

  // ── Zajedničko ───────────────────────────────────────────────────────────

  /** §2.8a "šta" dimenzija: jedan period, ili svi periodi jednog ugovora. */
  private async resolvePeriods(contractId?: string, contractPeriodId?: string) {
    if (!contractId && !contractPeriodId) {
      throw new BadRequestException('Zadati contractId (ceo objekat) ili contractPeriodId');
    }
    const where: Prisma.ContractPeriodWhereInput = contractPeriodId
      ? { id: contractPeriodId }
      : { contractId, status: 'ACTIVE' };
    const periods = await this.prisma.contractPeriod.findMany({ where });
    if (periods.length === 0) throw new NotFoundException('Nijedan period ne odgovara zahtevu');
    return periods;
  }
}
