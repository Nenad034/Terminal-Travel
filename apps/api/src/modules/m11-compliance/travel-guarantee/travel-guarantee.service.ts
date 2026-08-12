import { BadRequestException, Injectable } from '@nestjs/common';
import { TravelGuarantee } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { EventBusService } from '../../../common/events/event-bus.service';
import { ExchangeRatesService } from '../../m10-finansije/exchange-rates/exchange-rates.service';
import { UpdateTravelGuaranteeDto } from './dto/update-travel-guarantee.dto';

// M11 spec §2.2 — prag upozorenja.
const WARNING_THRESHOLD_PERCENT = 80;

// Hibridno rešenje za period bez važeće garancije (dogovoreno sa vlasnikom, avgust 2026,
// dopunjuje M11 spec §2.2): prodaja ORGANIZATOR aranžmana se ne blokira odmah čim garancija
// istekne (u praksi obnavljanje zna da kasni administrativno), ali se blokira ako period bez
// važeće garancije predugo traje — 15 dana je isti rok počeka koji već koristi M10 §6 za
// prihvatanje SEF fakture, dosledna konvencija za "razuman zakonski rok" kroz sistem.
const NO_GUARANTEE_GRACE_PERIOD_DAYS = 15;

export interface TravelGuaranteeAssessment {
  allowed: boolean;
  reason?: string;
}

export interface TravelGuaranteeUtilizationSnapshot {
  travelGuaranteeId: string | null;
  guaranteeStatus: TravelGuarantee['status'] | null;
  coverageAmount: number;
  currency: string;
  utilizedAmount: number;
  utilizationPercent: number;
  warningThresholdReached: boolean;
  inGracePeriod: boolean;
}

// M11 spec §2 — garancija putovanja (YUTA). "Nikad autonomno": izmena/obnavljanje garancije je
// uvek ljudska radnja (§2.1) — ovaj servis nikad sam ne piše u TravelGuarantee osim kroz update()
// koji uvek zahteva actor.userId i upisuje audit log.
@Injectable()
export class TravelGuaranteeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly eventBus: EventBusService,
    private readonly exchangeRates: ExchangeRatesService,
  ) {}

  // §5 — GET /travel-guarantee: "trenutna garancija" = najnovija po valid_to, bez obzira na status
  // (bootstrap slučaj kad još nijedna nije uneta vraća null).
  async findCurrent(): Promise<TravelGuarantee | null> {
    return this.prisma.travelGuarantee.findFirst({ orderBy: { validTo: 'desc' } });
  }

  // §2.1 — PATCH /travel-guarantee: uvek ljudska radnja. Ako još ne postoji nijedan zapis, ili je
  // dto.createNew=true (godišnje obnavljanje — nov policy_number), kreira nov zapis; inače menja
  // postojeći "trenutni".
  async update(dto: UpdateTravelGuaranteeDto, actor: { userId: string }): Promise<TravelGuarantee> {
    const current = await this.findCurrent();
    let result: TravelGuarantee;

    if (dto.createNew || !current) {
      if (!dto.provider || !dto.policyNumber || dto.coverageAmount == null || !dto.currency || !dto.validFrom || !dto.validTo) {
        throw new BadRequestException(
          'Za kreiranje nove garancije obavezni su provider, policyNumber, coverageAmount, currency, validFrom, validTo (M11 spec §2.1).',
        );
      }
      result = await this.prisma.travelGuarantee.create({
        data: {
          provider: dto.provider,
          policyNumber: dto.policyNumber,
          coverageAmount: dto.coverageAmount,
          currency: dto.currency,
          validFrom: new Date(dto.validFrom),
          validTo: new Date(dto.validTo),
          documentUrl: dto.documentUrl ?? null,
          status: dto.status ?? 'ACTIVE',
        },
      });
    } else {
      result = await this.prisma.travelGuarantee.update({
        where: { id: current.id },
        data: {
          provider: dto.provider ?? undefined,
          policyNumber: dto.policyNumber ?? undefined,
          coverageAmount: dto.coverageAmount ?? undefined,
          currency: dto.currency ?? undefined,
          validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
          validTo: dto.validTo ? new Date(dto.validTo) : undefined,
          documentUrl: dto.documentUrl ?? undefined,
          status: dto.status ?? undefined,
        },
      });
    }

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M11',
      action: !current || dto.createNew ? 'travel_guarantee.created' : 'travel_guarantee.updated',
      resourceType: 'TravelGuarantee',
      resourceId: result.id,
      beforeState: current,
      afterState: result,
    });

    return result;
  }

  // §5 — GET /travel-guarantee/utilization, i interni panel prikaz.
  async getUtilizationSnapshot(): Promise<TravelGuaranteeUtilizationSnapshot> {
    const guarantee = await this.findCurrent();
    if (!guarantee) {
      return {
        travelGuaranteeId: null,
        guaranteeStatus: null,
        coverageAmount: 0,
        currency: 'RSD',
        utilizedAmount: 0,
        utilizationPercent: 0,
        warningThresholdReached: false,
        inGracePeriod: false,
      };
    }

    const utilizedAmount = await this.computeUtilizedAmount(guarantee);
    const utilizationPercent = guarantee.coverageAmount === 0 ? 0 : (utilizedAmount / guarantee.coverageAmount) * 100;

    return {
      travelGuaranteeId: guarantee.id,
      guaranteeStatus: guarantee.status,
      coverageAmount: guarantee.coverageAmount,
      currency: guarantee.currency,
      utilizedAmount,
      utilizationPercent,
      warningThresholdReached: utilizationPercent >= WARNING_THRESHOLD_PERCENT,
      inGracePeriod: !this.isCurrentlyValid(guarantee),
    };
  }

  // M5 spec §4 korak 1a — poziva se u in-process pozivu iz ComplianceStubsService pre potvrde
  // ORGANIZATOR rezervacije (isti obrazac cross-modularnog poziva kao M10 PaymentsService →
  // M5 BookingsService). Kombinuje dve odvojene provere: (a) da li uopšte postoji dovoljno
  // sveža garancija (hibridni grace period, vidi NO_GUARANTEE_GRACE_PERIOD_DAYS), (b) da li bi
  // ova konkretna rezervacija prekoračila coverage_amount važeće garancije.
  async assessForBooking(params: { bookingTotalPrice: number; currency: string }): Promise<TravelGuaranteeAssessment> {
    const guarantee = await this.findCurrent();
    const now = new Date();

    if (!guarantee) {
      await this.eventBus.emit('M11', 'travel_guarantee_missing_urgent', { checkedAt: now.toISOString() });
      return { allowed: true };
    }

    if (!this.isCurrentlyValid(guarantee)) {
      const graceDeadline = new Date(guarantee.validTo.getTime() + NO_GUARANTEE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      if (now > graceDeadline) {
        return {
          allowed: false,
          reason: `Garancija putovanja (polisa ${guarantee.policyNumber}) je istekla ${guarantee.validTo.toISOString()} i prekoračen je rok počeka od ${NO_GUARANTEE_GRACE_PERIOD_DAYS} dana bez obnove — potvrda ORGANIZATOR rezervacije je blokirana dok se garancija ne obnovi (M11 spec §2.2).`,
        };
      }
      await this.eventBus.emit('M11', 'travel_guarantee_gap_urgent', {
        travelGuaranteeId: guarantee.id,
        validTo: guarantee.validTo.toISOString(),
        graceDeadline: graceDeadline.toISOString(),
      });
      return { allowed: true };
    }

    const utilizedAmount = await this.computeUtilizedAmount(guarantee);
    const additional = await this.convert(params.bookingTotalPrice, params.currency, guarantee.currency, now);
    const projected = utilizedAmount + additional;

    if (projected > guarantee.coverageAmount) {
      return {
        allowed: false,
        reason: 'Potvrda odbijena — prekoračenje limita garancije putovanja (M11 spec §2.2).',
      };
    }

    if (projected >= guarantee.coverageAmount * (WARNING_THRESHOLD_PERCENT / 100)) {
      await this.eventBus.emit('M11', 'travel_guarantee_utilization_warning', {
        travelGuaranteeId: guarantee.id,
        utilizedAmount: projected,
        coverageAmount: guarantee.coverageAmount,
        currency: guarantee.currency,
      });
    }

    return { allowed: true };
  }

  // §2.1 alarm (60/30/7 dana) i §2.2 hibridni grace-period alarm — poziva se periodično
  // (@Cron u M11AlarmsService), nezavisno od toga da li stiže neka nova rezervacija.
  async checkAndEmitHealthSignals(): Promise<void> {
    const guarantee = await this.findCurrent();
    const now = new Date();

    if (!guarantee) {
      await this.eventBus.emit('M11', 'travel_guarantee_missing_urgent', { checkedAt: now.toISOString() });
      return;
    }

    if (guarantee.status === 'ACTIVE') {
      const daysRemaining = Math.floor((guarantee.validTo.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      if ([60, 30, 7].includes(daysRemaining)) {
        await this.eventBus.emit('M11', 'travel_guarantee_expiring', {
          travelGuaranteeId: guarantee.id,
          daysRemaining,
          validTo: guarantee.validTo.toISOString(),
        });
      }
    }

    if (!this.isCurrentlyValid(guarantee)) {
      const graceDeadline = new Date(guarantee.validTo.getTime() + NO_GUARANTEE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      await this.eventBus.emit('M11', now > graceDeadline ? 'travel_guarantee_blocked' : 'travel_guarantee_gap_urgent', {
        travelGuaranteeId: guarantee.id,
        validTo: guarantee.validTo.toISOString(),
        graceDeadline: graceDeadline.toISOString(),
      });
    }
  }

  private isCurrentlyValid(guarantee: TravelGuarantee): boolean {
    const now = new Date();
    return guarantee.status === 'ACTIVE' && guarantee.validFrom <= now && guarantee.validTo >= now;
  }

  // §2.2 — kumulativna prodata vrednost ORGANIZATOR prometa (Booking.status != CANCELLED),
  // konvertovana u valutu garancije po tekućem kursu.
  private async computeUtilizedAmount(guarantee: TravelGuarantee): Promise<number> {
    const bookings = await this.prisma.booking.findMany({
      where: { tipNastupanja: 'ORGANIZATOR', status: { not: 'CANCELLED' } },
      select: { totalPrice: true, currency: true },
    });

    const now = new Date();
    let total = 0;
    for (const booking of bookings) {
      total += await this.convert(booking.totalPrice, booking.currency, guarantee.currency, now);
    }
    return total;
  }

  // Trougaona konverzija preko RSD — ExchangeRateSnapshot.nbsMiddleRate je uvek RSD po jedinici
  // strane valute (isti obrazac kao M10 FiscalDocumentsService.convertToRsd).
  private async convert(amount: number, fromCurrency: string, toCurrency: string, onDate: Date): Promise<number> {
    if (fromCurrency === toCurrency) return amount;

    if (toCurrency === 'RSD') {
      const snapshot = await this.exchangeRates.findForCurrencyOnOrBefore(fromCurrency, onDate);
      return Math.round(amount * Number(snapshot.nbsMiddleRate));
    }
    if (fromCurrency === 'RSD') {
      const snapshot = await this.exchangeRates.findForCurrencyOnOrBefore(toCurrency, onDate);
      return Math.round(amount / Number(snapshot.nbsMiddleRate));
    }
    const toRsd = await this.exchangeRates.findForCurrencyOnOrBefore(fromCurrency, onDate);
    const amountRsd = amount * Number(toRsd.nbsMiddleRate);
    const fromRsd = await this.exchangeRates.findForCurrencyOnOrBefore(toCurrency, onDate);
    return Math.round(amountRsd / Number(fromRsd.nbsMiddleRate));
  }
}
