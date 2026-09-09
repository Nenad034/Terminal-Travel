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
  /** §6 (v1.22) — `Product.type` vezanog objekta; `null` kad ugovor nema proizvod u M2. */
  productType: string | null;
  roomType: string;
  allotmentMode: string;
  days: CapacityDayState[];
}

const MS_DAY = 24 * 60 * 60 * 1000;

/**
 * §2.8g — akcije koje ulaze u istoriju izmena kapaciteta. Zatvorena lista, ne prefiks pretraga:
 * `module: 'M3'` nosi i ugovore, periode i dobavljače, a istorija kapaciteta pokazuje SAMO
 * poteze nad kapacitetom. Kad se doda nova radnja nad kapacitetom, njena akcija ide i ovde —
 * inače tiho izostaje iz istorije, a ekran izgleda ispravno.
 */
export const CAPACITY_HISTORY_ACTIONS = [
  'capacity.sale_stopped',
  'capacity.sale_reopened',
  'capacity.day_override_set',
  'capacity_block.created',
  'capacity_block.released',
  'capacity_block.converted',
  'capacity_block.auto_released',
];

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

    // §6 (v1.22) — filteri nad proizvodom (destinacija/naziv/vrsta) se rešavaju PRE upita nad
    // periodima: jedan upit nad `Product` daje skup ugovora koji ih zadovoljavaju, pa se dalje
    // radi isti upit kao i bez filtera. Period čiji ugovor nema proizvod u M2 tada ispada — što
    // je tačno, jer o njemu ne znamo ni destinaciju ni naziv, pa ne može ni da zadovolji uslov.
    const contractIdsByProduct = await this.contractIdsMatchingProductFilters(query);
    if (contractIdsByProduct !== null && contractIdsByProduct.length === 0) {
      return { from: isoDay(from), to: isoDay(to), rows: [] };
    }

    const periods = await this.prisma.contractPeriod.findMany({
      where: {
        status: 'ACTIVE',
        stayFrom: { lte: to },
        stayTo: { gte: from },
        contractId: contractIdsByProduct === null ? query.contractId : { in: contractIdsByProduct },
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
        type: true,
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
        productType: product?.type ?? null,
        roomType: period.roomType,
        allotmentMode: period.allotmentMode,
        days,
      };
    });

    return { from: isoDay(from), to: isoDay(to), rows };
  }

  /**
   * §6 (v1.22) — ugovori čiji vezani `Product` (M2) zadovoljava filtere destinacije, naziva i
   * vrste proizvoda. Vraća `null` kad nijedan od tih filtera nije postavljen — to je razlika
   * između „nema filtera, ne sužavaj" i „filter postoji, ali ništa ne odgovara" (prazan niz),
   * koju bi prazan niz sam po sebi izgubio.
   *
   * `contractId` iz upita ulazi u ISTI uslov, umesto da ostane zaseban — inače bi postavljanje
   * bilo kog filtera nad proizvodom tiho poništilo filter po ugovoru.
   */
  private async contractIdsMatchingProductFilters(
    query: CapacityGridQueryDto,
  ): Promise<string[] | null> {
    const hasProductFilter = Boolean(
      query.destinationCountry ||
      query.destinationCity ||
      query.productName ||
      (query.productType && query.productType.length > 0),
    );
    if (!hasProductFilter) return null;

    const products = await this.prisma.product.findMany({
      where: {
        sourceContractId: query.contractId ? query.contractId : { not: null },
        type: query.productType?.length ? { in: query.productType } : undefined,
        destinationCountry: query.destinationCountry
          ? { contains: query.destinationCountry, mode: 'insensitive' }
          : undefined,
        destinationCity: query.destinationCity
          ? { contains: query.destinationCity, mode: 'insensitive' }
          : undefined,
        translations: query.productName
          ? { some: { name: { contains: query.productName, mode: 'insensitive' } } }
          : undefined,
      },
      select: { sourceContractId: true },
    });

    return [...new Set(products.map((p) => p.sourceContractId).filter((id): id is string => !!id))];
  }

  // ── Istorija izmena (§2.8g) ──────────────────────────────────────────────

  /**
   * §2.8g — ko je, kada i šta promenio nad kapacitetom. NE uvodi novu tabelu: sve radnje ovog
   * servisa već upisuju `AuditLogEntry`, ovde se samo čitaju, sužavaju na zadat obim i dopunjuju
   * čitljivim imenom aktera (audit zapis čuva samo `actorId`). Isti obrazac kao „ceo workflow
   * rezervacije" (M5 §11, `BookingsService.history`).
   *
   * Dozvola je `M3/capacity/VIEW`, ne `M1/audit-log/VIEW` — vidi §2.8g za obrazloženje.
   */
  async capacityHistory(query: {
    contractId?: string;
    contractPeriodId?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) {
    // Obim: koji identifikatori uopšte mogu da stoje u `resource_id` za traženi izbor.
    // Stop-sale nad celim objektom nosi `contractId`, nad jednim tipom sobe `contractPeriodId`,
    // a blokade nose SVOJ id — zato se traže i identifikatori blokada tih perioda.
    let resourceIds: string[] | null = null;
    if (query.contractPeriodId || query.contractId) {
      const periods = await this.prisma.contractPeriod.findMany({
        where: query.contractPeriodId
          ? { id: query.contractPeriodId }
          : { contractId: query.contractId },
        select: { id: true },
      });
      const periodIds = periods.map((p) => p.id);
      const blocks = await this.prisma.capacityBlock.findMany({
        where: { contractPeriodId: { in: periodIds } },
        select: { id: true },
      });
      resourceIds = [
        ...periodIds,
        ...blocks.map((b) => b.id),
        ...(query.contractId ? [query.contractId] : []),
      ];
      if (resourceIds.length === 0) return [];
    }

    const entries = await this.prisma.auditLogEntry.findMany({
      where: {
        module: 'M3',
        action: { in: CAPACITY_HISTORY_ACTIONS },
        resourceId: resourceIds ? { in: resourceIds } : undefined,
        timestamp: {
          gte: query.from ? new Date(query.from) : undefined,
          // „do datuma" znači zaključno sa krajem tog dana — ista zamka koju je audit log
          // ekran već jednom platio (`endOfDayIfDateOnly`, M1 audit-log.controller.ts).
          lte: query.to
            ? new Date(new Date(query.to).getTime() + 24 * 60 * 60 * 1000 - 1)
            : undefined,
        },
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(query.limit ?? 50, 200),
    });

    const actorIds = [
      ...new Set(entries.map((e) => e.actorId).filter((v): v is string => Boolean(v))),
    ];
    const actors =
      actorIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, fullName: true },
          })
        : [];
    const nameById = new Map(actors.map((a) => [a.id, a.fullName]));

    return entries.map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      action: e.action,
      actorType: e.actorType,
      // Sistemski potezi (istekla blokada) nemaju aktera — „sistem" je tačan odgovor na „ko",
      // a nerazrešen UUID se ispisuje kakav jeste umesto da se sakrije.
      actorName: e.actorId ? (nameById.get(e.actorId) ?? e.actorId) : 'sistem',
      resourceType: e.resourceType,
      resourceId: e.resourceId,
      afterState: e.afterState,
      context: e.context,
    }));
  }

  // ── Stop-sale ────────────────────────────────────────────────────────────

  /**
   * §2.8a — dve nezavisne dimenzije obima: ŠTA (jedan period ili svi periodi ugovora) ×
   * KADA (jedan datum, raspon, ili ceo period). Sve kombinacije se svode na isti dnevni
   * zapis; "zatvori sve do kraja sezone" je masovni unos, ne poseban tip zapisa.
   */
  async setStopSale(dto: SetStopSaleDto, actorId: string, open = false) {
    const periods = await this.resolvePeriods(
      dto.contractId,
      dto.contractPeriodId,
      dto.contractPeriodIds,
    );
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
      resourceId: dto.contractPeriodId ?? dto.contractId ?? periods[0].id,
      afterState: { touched, from: isoDay(from), to: isoDay(to) },
      // §2.8g — spisak pogođenih perioda i tipova soba ide u `context` da bi istorija mogla da
      // pokaže ŠTA je tačno zahvaćeno kad je izabrano više tipova odjednom (v1.23).
      context: {
        reason: dto.reason,
        source: dto.source,
        periods: periods.length,
        contractPeriodIds: periods.map((p) => p.id),
        roomTypes: periods.map((p) => p.roomType),
      },
    });

    return { periods: periods.length, days: touched };
  }

  // ── Kapacitet po danu ────────────────────────────────────────────────────

  /** §2.8a — `capacity_override` za raspon; `null` vraća dan na kapacitet perioda. */
  async setCapacityOverride(dto: SetCapacityOverrideDto, actorId: string) {
    // v1.23 — više tipova soba odjednom (§2.8a). `resolvePeriods` bez `contractId` znači da je
    // ceo objekat ovde i dalje nedostupan: izmena KAPACITETA nad svim sobama objekta bi upisala
    // isti broj u svaki tip sobe, što je skoro uvek pogrešno (10 dvokrevetnih ≠ 10 apartmana).
    const periods = await this.resolvePeriods(
      undefined,
      dto.contractPeriodId,
      dto.contractPeriodIds,
    );

    const from = startOfDay(new Date(dto.dateFrom));
    const to = startOfDay(new Date(dto.dateTo));
    if (to < from) throw new BadRequestException('Datum „do" je pre datuma „od"');

    let touched = 0;
    for (const period of periods) {
      for (const day of enumerateDays(from, to)) {
        if (day < startOfDay(period.stayFrom) || day >= startOfDay(period.stayTo)) continue;
        await this.prisma.capacityDay.upsert({
          where: { contractPeriodId_date: { contractPeriodId: period.id, date: day } },
          create: { contractPeriodId: period.id, date: day, capacityOverride: dto.capacity },
          update: { capacityOverride: dto.capacity },
        });
        touched += 1;
      }
    }

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'capacity.day_override_set',
      resourceType: 'ContractPeriod',
      resourceId: periods[0].id,
      afterState: { capacity: dto.capacity, from: isoDay(from), to: isoDay(to), touched },
      context: {
        periods: periods.length,
        contractPeriodIds: periods.map((p) => p.id),
        roomTypes: periods.map((p) => p.roomType),
      },
    });

    return { days: touched, periods: periods.length };
  }

  // ── Blokade ──────────────────────────────────────────────────────────────

  /** §2.8b — `reason` i `holdUntil` su obavezni; DTO to sprovodi, ovde se samo upisuje. */
  async createBlock(dto: CreateCapacityBlockDto, actorId: string) {
    const periods = await this.resolvePeriods(
      undefined,
      dto.contractPeriodId,
      dto.contractPeriodIds,
    );

    const dateFrom = startOfDay(new Date(dto.dateFrom));
    const dateTo = startOfDay(new Date(dto.dateTo));
    if (dateTo < dateFrom) throw new BadRequestException('Datum „do" je pre datuma „od"');

    const holdUntil = new Date(dto.holdUntil);
    if (holdUntil.getTime() <= Date.now()) {
      throw new BadRequestException('Rok blokade mora biti u budućnosti (M3 spec §2.8b)');
    }

    // v1.23 — po jedna blokada PO TIPU SOBE. `units` se ne deli među tipovima: "blokiraj 2
    // jedinice" nad tri tipa znači dve u svakom, jer je to jedini izračun koji ne zavisi od
    // redosleda i koji čovek može da predvidi (§2.8b, DTO nosi isto obrazloženje).
    const blocks = [];
    for (const period of periods) {
      blocks.push(
        await this.prisma.capacityBlock.create({
          data: {
            contractPeriodId: period.id,
            dateFrom,
            dateTo,
            units: dto.units,
            reason: dto.reason,
            holdUntil,
            createdBy: actorId,
          },
        }),
      );
    }

    // Jedan potez čoveka = jedan audit zapis (§2.8g). Ostale blokade stoje u `context`, pa se u
    // istoriji vidi da su nastale zajedno, umesto tri odvojena reda bez veze među sobom.
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'capacity_block.created',
      resourceType: 'CapacityBlock',
      resourceId: blocks[0].id,
      afterState: blocks[0],
      context: {
        periods: periods.length,
        contractPeriodIds: periods.map((p) => p.id),
        roomTypes: periods.map((p) => p.roomType),
        blockIds: blocks.map((b) => b.id),
      },
    });

    return periods.length === 1 ? blocks[0] : { blocks, periods: periods.length };
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
  /**
   * §2.8a — tri vrednosti dimenzije „Šta" (v1.23): jedan tip sobe, IZABRANI tipovi soba, ili
   * ceo objekat. `contractPeriodId` i `contractPeriodIds` se spajaju u isti skup — ako stignu
   * oba, to je i dalje jedan potez, ne dva.
   */
  private async resolvePeriods(
    contractId?: string,
    contractPeriodId?: string,
    contractPeriodIds?: string[],
  ) {
    const ids = [
      ...new Set([...(contractPeriodIds ?? []), ...(contractPeriodId ? [contractPeriodId] : [])]),
    ];
    if (!contractId && ids.length === 0) {
      throw new BadRequestException(
        'Zadati contractId (ceo objekat) ili contractPeriodId/contractPeriodIds (izabrani tipovi soba)',
      );
    }
    const where: Prisma.ContractPeriodWhereInput =
      ids.length > 0 ? { id: { in: ids } } : { contractId, status: 'ACTIVE' };
    const periods = await this.prisma.contractPeriod.findMany({ where });
    if (periods.length === 0) throw new NotFoundException('Nijedan period ne odgovara zahtevu');
    // Traženi ali nepostojeći period je tiha greška najgore vrste: potez bi „uspeo" nad manjim
    // skupom nego što je čovek izabrao, a poruka bi rekla da je sve u redu.
    if (ids.length > 0 && periods.length !== ids.length) {
      const nadjeni = new Set(periods.map((p) => p.id));
      throw new NotFoundException(
        `Nisu pronađeni svi izabrani tipovi soba (nedostaje: ${ids.filter((i) => !nadjeni.has(i)).join(', ')})`,
      );
    }
    return periods;
  }
}
