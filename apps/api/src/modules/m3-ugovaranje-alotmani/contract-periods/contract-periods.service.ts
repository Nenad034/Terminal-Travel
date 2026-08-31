import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AllotmentMode, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { EventBusService } from '../../../common/events/event-bus.service';
import { CreateContractPeriodDto } from './dto/create-contract-period.dto';
import { UpsertRateLineDto } from './dto/upsert-rate-line.dto';
import { UpsertCancellationRuleDto } from './dto/upsert-cancellation-rule.dto';
import { UpsertOfferDto } from './dto/upsert-offer.dto';
import { UpsertAncillaryServiceDto } from './dto/upsert-ancillary-service.dto';
import { UpsertTouristTaxDto } from './dto/upsert-tourist-tax.dto';
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
      include: {
        rateLines: { include: { agePricing: true } },
        cancellationRules: true,
        offers: true,
        ancillaryServices: true,
        touristTaxInfo: true,
      },
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
        agePolicyOverride: dto.agePolicyOverride as unknown as Prisma.InputJsonValue,
        minStayNights: dto.minStayNights,
        maxStayNights: dto.maxStayNights,
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

  // §2.5 — dopuna v1.12: rule_type razdvaja PRE_ARRIVAL od EARLY_DEPARTURE (poglavlje 2.5)
  async upsertCancellationRule(periodId: string, dto: UpsertCancellationRuleDto, actorId: string) {
    const rule = await this.prisma.cancellationRule.create({
      data: {
        contractPeriodId: periodId,
        ruleType: dto.ruleType ?? 'PRE_ARRIVAL',
        daysBeforeStay: dto.daysBeforeStay,
        refundPercentage: dto.refundPercentage,
        earlyDepartureBasis: dto.earlyDepartureBasis,
        earlyDeparturePercentage: dto.earlyDeparturePercentage,
        earlyDepartureFlatAmount: dto.earlyDepartureFlatAmount,
      },
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

  // §2.4b — dopuna v1.12. PUT uvek KREIRA novi red (isti obrazac kao upsertRateLine).
  async upsertOffer(periodId: string, dto: UpsertOfferDto, actorId: string) {
    const offer = await this.prisma.pricelistOffer.create({
      data: {
        contractPeriodId: periodId,
        offerType: dto.offerType,
        bookingFrom: new Date(dto.bookingFrom),
        bookingTo: new Date(dto.bookingTo),
        discountType: dto.discountType,
        discountPercentage: dto.discountPercentage,
        discountAmount: dto.discountAmount,
        stayNights: dto.stayNights,
        payNights: dto.payNights,
        depositPercentage: dto.depositPercentage,
        depositDeadline: dto.depositDeadline ? new Date(dto.depositDeadline) : undefined,
        minAge: dto.minAge,
        maxAge: dto.maxAge,
        validArrivalWeekdays: dto.validArrivalWeekdays ?? [],
        excludedRoomTypes: dto.excludedRoomTypes ?? [],
        combinableWithOtherOffers: dto.combinableWithOtherOffers ?? false,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'pricelist_offer.upserted',
      resourceType: 'PricelistOffer',
      resourceId: offer.id,
      afterState: offer,
      context: { periodId },
    });
    return offer;
  }

  listOffers(periodId: string) {
    return this.prisma.pricelistOffer.findMany({ where: { contractPeriodId: periodId }, orderBy: { bookingFrom: 'asc' } });
  }

  // §2.6 — dopuna v1.12. PUT uvek KREIRA novi red (isti obrazac kao upsertRateLine).
  async upsertAncillaryService(periodId: string, dto: UpsertAncillaryServiceDto, actorId: string) {
    const service = await this.prisma.ancillaryService.create({
      data: {
        contractPeriodId: periodId,
        name: dto.name,
        pricingMode: dto.pricingMode,
        flatAmount: dto.flatAmount,
        percentageOfNightlyRate: dto.percentageOfNightlyRate,
        unit: dto.unit,
        isMandatory: dto.isMandatory ?? false,
        isRefundable: dto.isRefundable ?? false,
        maxQuantity: dto.maxQuantity,
        notes: dto.notes,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'ancillary_service.upserted',
      resourceType: 'AncillaryService',
      resourceId: service.id,
      afterState: service,
      context: { periodId },
    });
    return service;
  }

  listAncillaryServices(periodId: string) {
    return this.prisma.ancillaryService.findMany({ where: { contractPeriodId: periodId }, orderBy: { createdAt: 'asc' } });
  }

  // §2.7 — dopuna v1.12. 1:1 po periodu — pravi Prisma `upsert`, ne "uvek kreiraj novi red"
  // (za razliku od offers/ancillary-services, koji su liste). Isključivo informativno (ograda §2.7).
  async upsertTouristTax(periodId: string, dto: UpsertTouristTaxDto, actorId: string) {
    const data = {
      includedInPrice: dto.includedInPrice,
      collectedBy: dto.collectedBy,
      amountPerNight: dto.amountPerNight,
      currency: dto.currency,
      taxExemptMaxAge: dto.taxExemptMaxAge,
      notes: dto.notes,
    };
    const taxInfo = await this.prisma.touristTaxInfo.upsert({
      where: { contractPeriodId: periodId },
      create: { contractPeriodId: periodId, ...data },
      update: data,
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'tourist_tax_info.upserted',
      resourceType: 'TouristTaxInfo',
      resourceId: taxInfo.id,
      afterState: taxInfo,
      context: { periodId },
    });
    return taxInfo;
  }

  getTouristTax(periodId: string) {
    return this.prisma.touristTaxInfo.findUnique({ where: { contractPeriodId: periodId } });
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

  /**
   * M5 spec §4 korak 3 ("sve ili ništa — već rezervisane stavke se odmah oslobađaju") i
   * §6 ("otkazivanje — kapacitet se oslobađa nazad, units_sold se umanjuje"). Simetrično
   * `reserve()` — atomski umanjuje units_sold, nikad ispod 0. ON_REQUEST/nekapacitetni
   * periodi nemaju šta da oslobode (isto obrazloženje kao reserve()).
   */
  async release(periodId: string, units: number, actorId: string) {
    const period = await this.prisma.contractPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Period nije pronađen');

    if (!CAPACITY_BEARING_MODES.includes(period.allotmentMode)) {
      return { released: true, allotmentMode: period.allotmentMode };
    }

    const rows = await this.prisma.$queryRaw<{ id: string; units_sold: number; total_capacity: number }[]>`
      UPDATE contract_periods
      SET units_sold = GREATEST(units_sold - ${units}, 0)
      WHERE id = ${periodId}
      RETURNING id, units_sold, total_capacity
    `;
    const updated = rows[0];

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'contract_period.released',
      resourceType: 'ContractPeriod',
      resourceId: periodId,
      afterState: { unitsSold: updated.units_sold },
      context: { units },
    });

    return { released: true, unitsSold: updated.units_sold, remaining: updated.total_capacity - updated.units_sold };
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
