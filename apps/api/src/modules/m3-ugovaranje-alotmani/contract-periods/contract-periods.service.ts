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
import { UpdateContractPeriodDto } from './dto/update-contract-period.dto';
import { assertNoContractPeriodOverlap } from './overlap';
import { bookingWindowOpen, claimNights, DayCapacityError, releaseNights } from './day-capacity';

// §2.4c (v1.25) — audit akcija i tip resursa po cenovnoj stavci. Zatvorena mapa, ne izvedeno
// ime: audit log se pretražuje po tačnoj vrednosti, pa se ona ne sme menjati preimenovanjem
// promenljive u kodu.
const PRICELIST_DEACTIVATE_ACTION = {
  rateLine: 'rate_line.deactivated',
  pricelistOffer: 'pricelist_offer.deactivated',
  cancellationRule: 'cancellation_rule.deactivated',
  ancillaryService: 'ancillary_service.deactivated',
} as const;

const PRICELIST_RESOURCE_TYPE = {
  rateLine: 'RateLine',
  pricelistOffer: 'PricelistOffer',
  cancellationRule: 'CancellationRule',
  ancillaryService: 'AncillaryService',
} as const;

const CAPACITY_BEARING_MODES: AllotmentMode[] = ['FIXED', 'CHARTER', 'FIXED_LEASE'];

@Injectable()
export class ContractPeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly eventBus: EventBusService,
  ) {}

  findAll(contractId: string) {
    return this.prisma.contractPeriod.findMany({
      where: { contractId },
      orderBy: { stayFrom: 'asc' },
    });
  }

  findOne(id: string) {
    return this.prisma.contractPeriod.findUniqueOrThrow({
      where: { id },
      include: {
        // §2.4c pravilo 2 — ugašene stavke se NE sakrivaju sa ekrana: nestanak reda čita se
        // kao „nikad nije ni postojao", što je za cenu netačno. Aktivne idu prve.
        rateLines: {
          include: { agePricing: true },
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        },
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
    // §2.3e.2 — prozor prijave ulazi u proveru preklapanja: isti boravak sme da postoji
    // dvaput ako se prozori ne seku ("10 soba za prijave do 31.3., 5 za prijave posle").
    const bookingFrom = dto.bookingFrom ? new Date(dto.bookingFrom) : null;
    const bookingTo = dto.bookingTo ? new Date(dto.bookingTo) : null;
    if (bookingFrom && bookingTo && bookingFrom > bookingTo) {
      throw new BadRequestException('Prozor prijave: „od" mora biti pre „do" (M3 spec §2.3e)');
    }
    await assertNoContractPeriodOverlap(
      this.prisma,
      contractId,
      dto.roomType,
      stayFrom,
      stayTo,
      undefined,
      { from: bookingFrom, to: bookingTo },
    );

    const period = await this.prisma.contractPeriod.create({
      data: {
        contractId,
        stayFrom,
        stayTo,
        bookingFrom,
        bookingTo,
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

  /**
   * §2.3d — izmena postojećeg perioda.
   *
   * Dva pravila koja ova metoda sprovodi, oba iz specifikacije:
   *  1. promena datuma ili tipa sobe PONOVO prolazi kroz proveru preklapanja (§2.3b) — izmenom
   *     se lako napravi sukob koji pri unosu nije postojao;
   *  2. smanjenje kapaciteta ispod već prodatog se NE odbija (vlasnikova odluka 8.9.2026), ali
   *     traži svesnu drugu potvrdu (`confirmOversold`), i tada emituje `capacity_oversold`.
   *     Nijedna postojeća rezervacija se pri tom ne dira — koga premestiti je ljudska odluka.
   */
  async update(periodId: string, dto: UpdateContractPeriodDto, actorId: string) {
    const before = await this.prisma.contractPeriod.findUnique({ where: { id: periodId } });
    if (!before) throw new NotFoundException('Period nije pronađen');

    const stayFrom = dto.stayFrom ? new Date(dto.stayFrom) : before.stayFrom;
    const stayTo = dto.stayTo ? new Date(dto.stayTo) : before.stayTo;
    const roomType = dto.roomType ?? before.roomType;
    const bookingFrom =
      dto.bookingFrom === undefined
        ? before.bookingFrom
        : dto.bookingFrom === null
          ? null
          : new Date(dto.bookingFrom);
    const bookingTo =
      dto.bookingTo === undefined
        ? before.bookingTo
        : dto.bookingTo === null
          ? null
          : new Date(dto.bookingTo);
    if (bookingFrom && bookingTo && bookingFrom > bookingTo) {
      throw new BadRequestException('Prozor prijave: „od" mora biti pre „do" (M3 spec §2.3e)');
    }

    if (stayFrom >= stayTo) {
      throw new BadRequestException('Period boravka „od" mora biti pre „do"');
    }

    const datesOrRoomChanged =
      stayFrom.getTime() !== before.stayFrom.getTime() ||
      stayTo.getTime() !== before.stayTo.getTime() ||
      roomType !== before.roomType ||
      // §2.3e.2 — i promena prozora prijave može da napravi sukob koji pre izmene nije postojao
      (bookingFrom?.getTime() ?? null) !== (before.bookingFrom?.getTime() ?? null) ||
      (bookingTo?.getTime() ?? null) !== (before.bookingTo?.getTime() ?? null);
    if (datesOrRoomChanged) {
      await assertNoContractPeriodOverlap(
        this.prisma,
        before.contractId,
        roomType,
        stayFrom,
        stayTo,
        periodId,
        { from: bookingFrom, to: bookingTo },
      );
    }

    // Prodato se ne čita iz `units_sold` nego se poredi sa njim: `units_sold` je period-nivo
    // brojač (§2.8c) i za ovu proveru je tačno ono što treba — koliko je jedinica već obećano.
    const nextCapacity = dto.totalCapacity === undefined ? before.totalCapacity : dto.totalCapacity;
    const oversoldBy =
      nextCapacity !== null && nextCapacity !== undefined ? before.unitsSold - nextCapacity : 0;

    if (oversoldBy > 0 && !dto.confirmOversold) {
      throw new BadRequestException(
        `Kapacitet ${nextCapacity} je manji od već prodatih ${before.unitsSold} jedinica — ` +
          `${oversoldBy} ${oversoldBy === 1 ? 'jedinica ostaje' : 'jedinice/jedinica ostaju'} bez pokrića. ` +
          'Izmena je moguća, ali zahteva izričitu potvrdu (M3 spec §2.3d).',
      );
    }

    const period = await this.prisma.contractPeriod.update({
      where: { id: periodId },
      data: {
        stayFrom: dto.stayFrom ? stayFrom : undefined,
        stayTo: dto.stayTo ? stayTo : undefined,
        // `undefined` = ne diraj, `null` = skini prozor prijave (§2.3e, PATCH semantika)
        bookingFrom: dto.bookingFrom === undefined ? undefined : bookingFrom,
        bookingTo: dto.bookingTo === undefined ? undefined : bookingTo,
        roomType: dto.roomType,
        allotmentMode: dto.allotmentMode,
        totalCapacity: dto.totalCapacity,
        releaseDaysBefore: dto.releaseDaysBefore,
        ukupnaFiksnaObaveza: dto.ukupnaFiksnaObaveza,
        fixedObligationCurrency: dto.fixedObligationCurrency,
        minStayNights: dto.minStayNights,
        maxStayNights: dto.maxStayNights,
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'contract_period.updated',
      resourceType: 'ContractPeriod',
      resourceId: periodId,
      beforeState: before,
      afterState: period,
      context: { oversoldBy: oversoldBy > 0 ? oversoldBy : undefined },
    });

    // §2.3d/M18 spec §2.1 — potvrđen gost ostaje bez pokrića; CRITICAL, jer se ne oslanjamo
    // na to da neko baš tada gleda mrežu kapaciteta.
    if (oversoldBy > 0) {
      await this.eventBus.emit('M3', 'capacity_oversold', {
        periodId,
        contractId: before.contractId,
        previousCapacity: before.totalCapacity,
        newCapacity: nextCapacity,
        unitsSold: before.unitsSold,
        oversoldBy,
        severity: 'CRITICAL',
      });
    }

    return period;
  }

  /**
   * §2.3d — gašenje ili brisanje perioda.
   *
   * Period koji ima ijednu rezervaciju se NE briše nego prelazi u `INACTIVE`: brisanje bi
   * prekinulo vezu prodatog sa cenom i kapacitetom po kojima je prodato (`BookingItem` →
   * `RateLine` → ovaj period). Period bez ijedne rezervacije se briše stvarno — nema šta da
   * ostane.
   */
  async remove(periodId: string, actorId: string) {
    const period = await this.prisma.contractPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Period nije pronađen');

    const bookedItems = await this.prisma.bookingItem.count({
      where: { rateLine: { contractPeriodId: periodId } },
    });

    if (bookedItems > 0) {
      const deactivated = await this.prisma.contractPeriod.update({
        where: { id: periodId },
        data: { status: 'INACTIVE', deactivatedBy: actorId, deactivatedAt: new Date() },
      });
      await this.auditLog.write({
        actorType: 'HUMAN',
        actorId,
        module: 'M3',
        action: 'contract_period.deactivated',
        resourceType: 'ContractPeriod',
        resourceId: periodId,
        beforeState: period,
        afterState: deactivated,
        context: { bookedItems },
      });
      return { deleted: false, status: deactivated.status, bookedItems };
    }

    await this.prisma.contractPeriod.delete({ where: { id: periodId } });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'contract_period.deleted',
      resourceType: 'ContractPeriod',
      resourceId: periodId,
      beforeState: period,
      context: { bookedItems: 0 },
    });
    return { deleted: true, status: null, bookedItems: 0 };
  }

  // §2.4
  /**
   * M3 §2.4c (v1.25) — ŽIVOTNI CIKLUS CENOVNE STAVKE.
   *
   * Do v1.25 se cenovna stavka mogla samo dodati: sva četiri `upsert*` metoda ispod zovu
   * `create`, a kontroler nije imao ni `PATCH` ni `DELETE`. Pogrešno ukucana cena se nije
   * mogla povući, a `SearchService` od SVAKE cenovne linije pravi zasebnu ponudu — pa je
   * pogrešna cena ostajala prodajna, uporedo sa ispravnom.
   *
   * Vlasnikova odluka 9.9.2026: ispravka je **gašenje stare i upis nove**, nikad prepisivanje
   * vrednosti — cena je finansijski podatak i posle izmene mora ostati odgovor po kojoj je
   * ceni nešto prodato pre nje.
   *
   * Gašenje NAMERNO ne proverava da li je stavka prodata: rezervacija nosi svoju cenovnu
   * liniju kao snimak (M5 §6), pa se prošlost ne dira — a takva provera bi zabranila ispravku
   * baš tamo gde je najpotrebnija.
   */
  async deactivateRateLine(periodId: string, rateLineId: string, actorId: string) {
    return this.deactivatePricelistItem('rateLine', periodId, rateLineId, actorId);
  }

  async deactivateOffer(periodId: string, offerId: string, actorId: string) {
    return this.deactivatePricelistItem('pricelistOffer', periodId, offerId, actorId);
  }

  async deactivateCancellationRule(periodId: string, ruleId: string, actorId: string) {
    return this.deactivatePricelistItem('cancellationRule', periodId, ruleId, actorId);
  }

  async deactivateAncillaryService(periodId: string, serviceId: string, actorId: string) {
    return this.deactivatePricelistItem('ancillaryService', periodId, serviceId, actorId);
  }

  /** Zajedničko gašenje — četiri stavke se razlikuju samo po tabeli i nazivu audit akcije. */
  private async deactivatePricelistItem(
    model: 'rateLine' | 'pricelistOffer' | 'cancellationRule' | 'ancillaryService',
    periodId: string,
    id: string,
    actorId: string,
  ) {
    const delegate = this.prisma[model] as unknown as {
      findUnique: (
        a: unknown,
      ) => Promise<{ id: string; contractPeriodId: string; status: string } | null>;
      update: (a: unknown) => Promise<{ id: string }>;
    };
    const postojeca = await delegate.findUnique({ where: { id } });
    if (!postojeca) throw new NotFoundException('Cenovna stavka nije pronađena');
    // Stavka drugog perioda se ne sme ugasiti kroz tuđu adresu — inače bi greška u URL-u
    // tiho isključila cenu na sasvim drugom ugovoru.
    if (postojeca.contractPeriodId !== periodId) {
      throw new BadRequestException('Cenovna stavka ne pripada navedenom periodu');
    }
    if (postojeca.status === 'INACTIVE') return postojeca;

    const ugasena = await delegate.update({
      where: { id },
      data: { status: 'INACTIVE', deactivatedBy: actorId, deactivatedAt: new Date() },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: PRICELIST_DEACTIVATE_ACTION[model],
      resourceType: PRICELIST_RESOURCE_TYPE[model],
      resourceId: id,
      beforeState: postojeca,
      afterState: ugasena,
      context: { contractPeriodId: periodId },
    });
    return ugasena;
  }

  /**
   * §2.4c — ispravka je JEDAN potez, ne dva: gašenje stare i upis nove idu u istoj
   * transakciji. Da su dva odvojena poziva, prekid između njih ostavio bi period bez ijedne
   * važeće cene — a to je stanje u kom se ne sme prodavati.
   */
  async replaceRateLine(
    periodId: string,
    rateLineId: string,
    dto: UpsertRateLineDto,
    actorId: string,
  ) {
    const stara = await this.prisma.rateLine.findUnique({ where: { id: rateLineId } });
    if (!stara) throw new NotFoundException('Cenovna stavka nije pronađena');
    if (stara.contractPeriodId !== periodId) {
      throw new BadRequestException('Cenovna stavka ne pripada navedenom periodu');
    }

    const nova = await this.prisma.$transaction(async (tx) => {
      await tx.rateLine.update({
        where: { id: rateLineId },
        data: { status: 'INACTIVE', deactivatedBy: actorId, deactivatedAt: new Date() },
      });
      return tx.rateLine.create({
        data: {
          contractPeriodId: periodId,
          replacesId: rateLineId,
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
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'rate_line.replaced',
      resourceType: 'RateLine',
      resourceId: nova.id,
      beforeState: stara,
      afterState: nova,
      context: { contractPeriodId: periodId, replacesId: rateLineId },
    });
    return nova;
  }

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
    return this.prisma.rateLine.findMany({
      where: { contractPeriodId: periodId },
      include: { agePricing: true },
    });
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
    return this.prisma.cancellationRule.findMany({
      where: { contractPeriodId: periodId },
      orderBy: { daysBeforeStay: 'desc' },
    });
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
    return this.prisma.pricelistOffer.findMany({
      where: { contractPeriodId: periodId },
      orderBy: { bookingFrom: 'asc' },
    });
  }

  // §2.6 — dopuna v1.12. PUT uvek KREIRA novi red (isti obrazac kao upsertRateLine).
  async upsertAncillaryService(periodId: string, dto: UpsertAncillaryServiceDto, actorId: string) {
    const service = await this.prisma.ancillaryService.create({
      data: {
        contractPeriodId: periodId,
        name: dto.name,
        // §2.6 v1.13 — doplata ili popust, osnova kao PAR, granice po sastavu gostiju i mesto
        // plaćanja. Podrazumevane vrednosti (`SURCHARGE`/`AGENCY`) drže postojeći unos
        // nepromenjenim: ko ne pošalje ništa novo dobija ono što je i pre v1.13 upisivao.
        kind: dto.kind ?? 'SURCHARGE',
        pricingMode: dto.pricingMode,
        flatAmount: dto.flatAmount,
        percentageOfNightlyRate: dto.percentageOfNightlyRate,
        priceBasis: dto.priceBasis,
        coversPersons: dto.coversPersons,
        maxAdults: dto.maxAdults,
        maxChildren: dto.maxChildren,
        childMaxAge: dto.childMaxAge,
        payable: dto.payable ?? 'AGENCY',
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
    return this.prisma.ancillaryService.findMany({
      where: { contractPeriodId: periodId },
      orderBy: { createdAt: 'asc' },
    });
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
      return {
        allotmentMode: period.allotmentMode,
        unlimited: false,
        requiresSupplierConfirmation: true,
      };
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
  /**
   * M3 spec §2.8c/§2.3e.4 — provera kapaciteta ide PO DANU, ne po periodu.
   *
   * `stay` je opcion samo zbog zatečenih pozivalaca; kad se prosledi (a M5 ga uvek prosleđuje),
   * radi se dnevna provera koja poštuje stop-sale, blokade i dnevni `capacity_override`.
   * Bez njega ostaje stara provera na nivou perioda — namerno zadržana da poziv ne pukne,
   * ali ona NE vidi stop-sale ni blokade i ne sme se koristiti u prodajnom toku.
   */
  async reserve(
    periodId: string,
    units: number,
    actorId: string,
    stay?: { from: Date; to: Date },
    bookingDate: Date = new Date(),
  ) {
    const period = await this.prisma.contractPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Period nije pronađen');

    // §2.3e.4 — prozor prijave. Provera ide PRE kapaciteta: "zakasnili ste" i "nema mesta"
    // su dve različite činjenice, a agent na njih različito reaguje.
    if (!bookingWindowOpen(period, bookingDate)) {
      throw new BadRequestException({
        statusCode: 400,
        reason: 'BOOKING_WINDOW_CLOSED',
        message:
          `Prozor za prijave je zatvoren za ovaj period ` +
          `(${period.bookingFrom?.toISOString().slice(0, 10) ?? '—'} do ` +
          `${period.bookingTo?.toISOString().slice(0, 10) ?? '—'}, M3 spec §2.3e).`,
      });
    }

    if (!CAPACITY_BEARING_MODES.includes(period.allotmentMode)) {
      // ON_REQUEST nema kapacitet, ali stop-sale nad njim znači "ne šalji više upite" (§2.8a).
      if (stay) {
        const zatvoren = await this.prisma.capacityDay.findFirst({
          where: {
            contractPeriodId: periodId,
            saleStatus: 'STOP',
            date: { gte: stay.from, lt: stay.to },
          },
        });
        if (zatvoren) {
          throw new DayCapacityError(
            'SALE_STOPPED',
            zatvoren.date.toISOString().slice(0, 10),
            `Prodaja je zatvorena za ${zatvoren.date.toISOString().slice(0, 10)} (M3 spec §2.8a).`,
          );
        }
      }
      return {
        reserved: true,
        allotmentMode: period.allotmentMode,
        requiresSupplierConfirmation: true,
      };
    }

    if (period.totalCapacity === null) {
      throw new BadRequestException('Period sa kapacitetom nema upisan total_capacity (M3 §2.3)');
    }

    if (!stay) {
      // Zatečeni put — provera na nivou perioda. Ne vidi stop-sale ni blokade (§2.8c).
      const rows = await this.prisma.$queryRaw<
        { id: string; units_sold: number; total_capacity: number }[]
      >`
        UPDATE contract_periods
        SET units_sold = units_sold + ${units}
        WHERE id = ${periodId} AND units_sold + ${units} <= total_capacity
        RETURNING id, units_sold, total_capacity
      `;
      if (rows.length === 0) {
        throw new BadRequestException(
          'Nema dovoljno preostalog kapaciteta za ovaj period (M3 spec §2.3)',
        );
      }
      return this.posleRezervacije(periodId, units, actorId, rows[0]);
    }

    // Dnevni put — sve noći ili nijedna, u jednoj transakciji.
    const updated = await this.prisma.$transaction(async (tx) => {
      await claimNights(tx, periodId, stay.from, stay.to, units, period.totalCapacity!);
      // `units_sold` na periodu OSTAJE (§2.8c) — više nije provera, nego zbir za rok povrata
      // i alarm niskog kapaciteta. Zato se uvećava bez uslova: dnevna provera je već prošla.
      const rows = await tx.$queryRaw<{ id: string; units_sold: number; total_capacity: number }[]>`
        UPDATE contract_periods
        SET units_sold = units_sold + ${units}
        WHERE id = ${periodId}
        RETURNING id, units_sold, total_capacity
      `;
      return rows[0];
    });

    return this.posleRezervacije(periodId, units, actorId, updated);
  }

  /** Zajednički rep oba puta: audit zapis i alarm za nizak kapacitet (§4.3). */
  private async posleRezervacije(
    periodId: string,
    units: number,
    actorId: string,
    updated: { units_sold: number; total_capacity: number },
  ) {
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
      await this.eventBus.emit('M3', 'low_capacity_critical', {
        periodId,
        remaining,
        severity: 'CRITICAL',
      });
    } else if (remaining === 2) {
      await this.eventBus.emit('M3', 'low_capacity_critical', {
        periodId,
        remaining,
        severity: 'WARNING',
      });
    }

    return { reserved: true, unitsSold: updated.units_sold, remaining };
  }

  /**
   * M5 spec §4 korak 3 ("sve ili ništa — već rezervisane stavke se odmah oslobađaju") i
   * §6 ("otkazivanje — kapacitet se oslobađa nazad, units_sold se umanjuje"). Simetrično
   * `reserve()` — atomski umanjuje units_sold, nikad ispod 0. ON_REQUEST/nekapacitetni
   * periodi nemaju šta da oslobode (isto obrazloženje kao reserve()).
   */
  async release(periodId: string, units: number, actorId: string, stay?: { from: Date; to: Date }) {
    const period = await this.prisma.contractPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Period nije pronađen');

    if (!CAPACITY_BEARING_MODES.includes(period.allotmentMode)) {
      return { released: true, allotmentMode: period.allotmentMode };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // §2.8c — dnevni brojač se vraća simetrično uzimanju; bez ovoga bi otkazana
      // rezervacija zauvek držala noći koje više nikome ne pripadaju.
      if (stay) await releaseNights(tx, periodId, stay.from, stay.to, units);
      const rows = await tx.$queryRaw<{ id: string; units_sold: number; total_capacity: number }[]>`
        UPDATE contract_periods
        SET units_sold = GREATEST(units_sold - ${units}, 0)
        WHERE id = ${periodId}
        RETURNING id, units_sold, total_capacity
      `;
      return rows[0];
    });

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

    return {
      released: true,
      unitsSold: updated.units_sold,
      remaining: updated.total_capacity - updated.units_sold,
    };
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
