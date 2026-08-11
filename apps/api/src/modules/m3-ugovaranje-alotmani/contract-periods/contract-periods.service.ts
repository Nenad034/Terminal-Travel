import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AllotmentMode, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { EventBusService } from '../../../common/events/event-bus.service';
import { CreateContractPeriodDto } from './dto/create-contract-period.dto';
import { UpsertRateLineDto } from './dto/upsert-rate-line.dto';
import { UpsertCancellationRuleDto } from './dto/upsert-cancellation-rule.dto';
import { assertNoContractPeriodOverlap } from './overlap';

const CAPACITY_BEARING_MODES: AllotmentMode[] = ['FIXED', 'CHARTER', 'FIXED_LEASE'];

@Injectable()
export class ContractPeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly eventBus: EventBusService,
  ) {}

  findAll(contractId: string) {
    return this.prisma.contractPeriod.findMany({ where: { contractId }, orderBy: { stayFrom: 'asc' } });
  }

  findOne(id: string) {
    return this.prisma.contractPeriod.findUniqueOrThrow({
      where: { id },
      include: { rateLines: { include: { agePricing: true } }, cancellationRules: true },
    });
  }

  async create(contractId: string, dto: CreateContractPeriodDto, actorId: string) {
    const stayFrom = new Date(dto.stayFrom);
    const stayTo = new Date(dto.stayTo);
    await assertNoContractPeriodOverlap(this.prisma, contractId, dto.roomType, stayFrom, stayTo);

    const period = await this.prisma.contractPeriod.create({
      data: {
        contractId,
        stayFrom,
        stayTo,
        roomType: dto.roomType,
        allotmentMode: dto.allotmentMode,
        totalCapacity: dto.totalCapacity,
        releaseDaysBefore: dto.releaseDaysBefore,
        ukupnaFiksnaObaveza: dto.ukupnaFiksnaObaveza,
        fixedObligationCurrency: dto.fixedObligationCurrency,
        paymentSchedule: dto.paymentSchedule as unknown as Prisma.InputJsonValue,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'contract_period.created',
      resourceType: 'ContractPeriod',
      resourceId: period.id,
      afterState: period,
      context: { contractId },
    });
    return period;
  }

  // §2.4
  async upsertRateLine(periodId: string, dto: UpsertRateLineDto, actorId: string) {
    const rateLine = await this.prisma.rateLine.create({
      data: {
        contractPeriodId: periodId,
        boardType: dto.boardType,
        occupancy: dto.occupancy,
        priceBasis: dto.priceBasis,
        price: dto.price,
        cribFeePerNight: dto.cribFeePerNight,
        agePricing: dto.agePricing
          ? {
              create: dto.agePricing.map((a) => ({
                ageCategory: a.ageCategory,
                occupantIndex: a.occupantIndex,
                minAdultsPresent: a.minAdultsPresent,
                pricingMode: a.pricingMode,
                percentage: a.percentage,
                flatPrice: a.flatPrice,
              })),
            }
          : undefined,
      },
      include: { agePricing: true },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'rate_line.upserted',
      resourceType: 'RateLine',
      resourceId: rateLine.id,
      afterState: rateLine,
      context: { periodId },
    });
    return rateLine;
  }

  listRateLines(periodId: string) {
    return this.prisma.rateLine.findMany({ where: { contractPeriodId: periodId }, include: { agePricing: true } });
  }

  // §2.5
  async upsertCancellationRule(periodId: string, dto: UpsertCancellationRuleDto, actorId: string) {
    const rule = await this.prisma.cancellationRule.create({
      data: { contractPeriodId: periodId, daysBeforeStay: dto.daysBeforeStay, refundPercentage: dto.refundPercentage },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'cancellation_rule.upserted',
      resourceType: 'CancellationRule',
      resourceId: rule.id,
      afterState: rule,
      context: { periodId },
    });
    return rule;
  }

  listCancellationRules(periodId: string) {
    return this.prisma.cancellationRule.findMany({ where: { contractPeriodId: periodId }, orderBy: { daysBeforeStay: 'desc' } });
  }

  async availability(periodId: string) {
    const period = await this.prisma.contractPeriod.findUniqueOrThrow({ where: { id: periodId } });
    if (period.totalCapacity === null) {
      return { allotmentMode: period.allotmentMode, unlimited: false, requiresSupplierConfirmation: true };
    }
    return {
      allotmentMode: period.allotmentMode,
      totalCapacity: period.totalCapacity,
      unitsSold: period.unitsSold,
      remaining: period.totalCapacity - period.unitsSold,
    };
  }

  /**
   * M3 spec §2.3/§6 — interni poziv (samo M5). Atomski umanjuje (uvećava units_sold)
   * jednim UPDATE-om sa uslovom u WHERE — Postgres-ov row-level lock nad tim redom
   * garantuje da dva konkurentna poziva ne mogu oba proći preko kapaciteta (§2.3
   * napomena o konkurentnosti). ON_REQUEST periodi (bez kapaciteta) uvek prolaze —
   * njihova potvrda ide kroz ručni/API tok dobavljača, ne kroz brojanje kapaciteta.
   */
  async reserve(periodId: string, units: number, actorId: string) {
    const period = await this.prisma.contractPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Period nije pronađen');

    if (!CAPACITY_BEARING_MODES.includes(period.allotmentMode)) {
      return { reserved: true, allotmentMode: period.allotmentMode, requiresSupplierConfirmation: true };
    }

    const rows = await this.prisma.$queryRaw<{ id: string; units_sold: number; total_capacity: number }[]>`
      UPDATE contract_periods
      SET units_sold = units_sold + ${units}
      WHERE id = ${periodId} AND units_sold + ${units} <= total_capacity
      RETURNING id, units_sold, total_capacity
    `;

    if (rows.length === 0) {
      throw new BadRequestException('Nema dovoljno preostalog kapaciteta za ovaj period (M3 spec §2.3)');
    }

    const updated = rows[0];
    const remaining = updated.total_capacity - updated.units_sold;

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'contract_period.reserved',
      resourceType: 'ContractPeriod',
      resourceId: periodId,
      afterState: { unitsSold: updated.units_sold },
      context: { units, remaining },
    });

    // §4.3 — alarm za nizak preostali kapacitet. M18 (Operativni nadzor) još ne postoji
    // kao Prisma model — emituje se preko Event Bus-a (isti mehanizam kao M2
    // product.published), M18 se pretplaćuje kad taj modul dođe na red.
    if (remaining === 1) {
      await this.eventBus.emit('M3', 'low_capacity_critical', { periodId, remaining, severity: 'CRITICAL' });
    } else if (remaining === 2) {
      await this.eventBus.emit('M3', 'low_capacity_critical', { periodId, remaining, severity: 'WARNING' });
    }

    return { reserved: true, unitsSold: updated.units_sold, remaining };
  }

  // §6 — GET /contracts/expiring-releases
  async expiringReleases() {
    const periods = await this.prisma.contractPeriod.findMany({
      where: { allotmentMode: 'FIXED', releaseDaysBefore: { not: null } },
    });
    const now = Date.now();
    return periods.filter((p) => {
      if (p.totalCapacity === null || p.unitsSold >= p.totalCapacity) return false; // nema neprodatog kapaciteta
      const daysUntilStay = Math.ceil((p.stayFrom.getTime() - now) / (24 * 60 * 60 * 1000));
      return daysUntilStay <= (p.releaseDaysBefore ?? 0);
    });
  }
}
