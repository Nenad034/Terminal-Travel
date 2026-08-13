import { Injectable, NotFoundException } from '@nestjs/common';
import { CommissionVolumeMetric, CommissionVolumePeriod, CommissionVolumeTier, Subagent, SubagentVolumeStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { CommissionRebatesService } from './commission-rebates.service';

/**
 * M7 spec §3.1/§3.2 — SubagentVolumeStatus: automatski preračun na booking.confirmed/
 * booking.cancelled (M5 Event Bus), isti obrazac kao M6 ClientLoyaltyStatusService.
 *
 * Implementaciona napomena (mehanička dopuna, avgust 2026, isti princip kao M6 §3.2 komentar):
 * spec ne definiše tačnu formulu za calculated_metric_value po tipu metrike — ovde je odabrano:
 * TOTAL_SALES_RSD sabira Booking.total_price isključivo za rezervacije u valuti RSD, BOOKING_COUNT
 * broji ne-otkazane rezervacije, NIGHT_COUNT sabira broj noćenja preko ne-otkazanih BookingItem
 * stavki. Period se primenjuje na Booking.confirmed_at.
 */
@Injectable()
export class SubagentVolumeStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rebates: CommissionRebatesService,
    private readonly auditLog: AuditLogService,
  ) {}

  // NAMERNO direktan Prisma upit umesto SubagentsService.findOneOrThrow — vidi napomenu u
  // CommissionAuthorityService o kružnoj zavisnosti SubagentsModule ↔ CommissionModule.
  private async findSubagentOrThrow(id: string): Promise<Subagent> {
    const subagent = await this.prisma.subagent.findUnique({ where: { id } });
    if (!subagent) throw new NotFoundException(`Subagent ${id} nije pronađen.`);
    return subagent;
  }

  async get(subagentId: string) {
    const status = await this.prisma.subagentVolumeStatus.findUnique({ where: { subagentId }, include: { currentTier: true } });
    if (status) return status;

    // Nema još nijednog preračuna — efektivna provizija je osnovna (§3.1: "inače Subagent.
    // commission_percentage" ako prag nije dostignut).
    const subagent = await this.findSubagentOrThrow(subagentId);
    return {
      id: null,
      subagentId,
      calculatedMetricValue: 0,
      currentTierId: null,
      currentTier: null,
      effectiveCommissionPercentage: Number(subagent.commissionPercentage ?? 0),
      periodStart: null,
      periodEnd: null,
      lastRecalculatedAt: null,
    };
  }

  // §5 — koristi se u M5 toku cene (SubagentStubService, m5/common). Vraća samo procenat,
  // uvek dostupno čak i pre prvog preračuna (osnovna provizija).
  async getEffectiveCommissionPercentage(subagentId: string): Promise<number> {
    const status = await this.get(subagentId);
    return Number(status.effectiveCommissionPercentage ?? 0);
  }

  // Poziva se iz M7EventSubscribersService na booking.confirmed/booking.cancelled.
  async recalculate(subagentId: string): Promise<SubagentVolumeStatus> {
    const subagent = await this.findSubagentOrThrow(subagentId);
    const tiers = await this.prisma.commissionVolumeTier.findMany({ where: { subagentId }, orderBy: { rank: 'desc' } });
    const now = new Date();

    let matchedTier: CommissionVolumeTier | null = null;
    let metricValue = 0;
    let periodStart: Date;
    let periodEnd: Date;

    if (tiers.length === 0) {
      const bounds = this.periodBounds('CALENDAR_YEAR', now);
      periodStart = bounds.start;
      periodEnd = bounds.end;
    } else {
      for (const tier of tiers) {
        const bounds = this.periodBounds(tier.thresholdPeriod, now);
        const value = await this.computeMetric(subagent.clientAccountId, tier.thresholdMetric, bounds.start, bounds.end);
        if (value >= Number(tier.thresholdValue)) {
          matchedTier = tier;
          metricValue = value;
          periodStart = bounds.start;
          periodEnd = bounds.end;
          break;
        }
      }
      if (!matchedTier) {
        const lowest = tiers[tiers.length - 1];
        const bounds = this.periodBounds(lowest.thresholdPeriod, now);
        metricValue = await this.computeMetric(subagent.clientAccountId, lowest.thresholdMetric, bounds.start, bounds.end);
        periodStart = bounds.start;
        periodEnd = bounds.end;
      }
    }

    const existing = await this.prisma.subagentVolumeStatus.findUnique({ where: { subagentId } });
    const previousTierId = existing?.currentTierId ?? null;
    const tierChanged = previousTierId !== (matchedTier?.id ?? null);

    const effectivePercentage = matchedTier
      ? Number(matchedTier.resultingCommissionPercentage ?? subagent.commissionPercentage ?? 0)
      : Number(subagent.commissionPercentage ?? 0);

    const updated = await this.prisma.subagentVolumeStatus.upsert({
      where: { subagentId },
      create: {
        subagentId,
        calculatedMetricValue: metricValue,
        currentTierId: matchedTier?.id ?? null,
        effectiveCommissionPercentage: effectivePercentage,
        periodStart: periodStart!,
        periodEnd: periodEnd!,
        lastRecalculatedAt: now,
      },
      update: {
        calculatedMetricValue: metricValue,
        currentTierId: matchedTier?.id ?? null,
        effectiveCommissionPercentage: effectivePercentage,
        periodStart: periodStart!,
        periodEnd: periodEnd!,
        lastRecalculatedAt: now,
      },
    });

    // §3.2 — retroaktivni rabat: SAMO na prelazak (tierChanged) ka novom tier-u koji je
    // retroactive=true, usred perioda (postoji prethodno stanje, tj. nije prvi preračun).
    if (tierChanged && matchedTier?.retroactive && existing) {
      await this.maybeCreateRetroactiveRebate(subagent.clientAccountId, subagentId, matchedTier, existing, periodStart!, periodEnd!);
    }

    // §3 ograda dopuna — ako roditeljev obimski bonus istekne i njegova efektivna provizija
    // padne ispod već postavljene provizije deteta, prijaviti kao upozorenje (ne menjati tiho).
    await this.warnIfChildrenExceedNewCeiling(subagentId, effectivePercentage);

    return updated;
  }

  // §3.1 ograda dopuna — upozorenje se upisuje kao append-only audit log zapis (actorType SYSTEM),
  // NE menja Subagent.commission_percentage deteta — princip #4 Master dokumenta (determinizam
  // pre autonomije): tiho menjanje već dogovorene provizije bez ljudske odluke nije prihvatljivo.
  private async warnIfChildrenExceedNewCeiling(subagentId: string, newEffectiveCeiling: number): Promise<void> {
    const children = await this.prisma.subagent.findMany({ where: { parentSubagentId: subagentId } });
    for (const child of children) {
      if (child.commissionPercentage != null && Number(child.commissionPercentage) > newEffectiveCeiling) {
        await this.auditLog.write({
          actorType: 'SYSTEM',
          module: 'M7',
          action: 'subagent.commission_ceiling_warning',
          resourceType: 'Subagent',
          resourceId: child.id,
          context: {
            parentSubagentId: subagentId,
            childCommissionPercentage: Number(child.commissionPercentage),
            parentNewEffectiveCommissionPercentage: newEffectiveCeiling,
            message: 'Roditeljeva efektivna provizija je pala ispod već postavljene provizije deteta — potreban ljudski pregled (M7 spec §3.1).',
          },
        });
      }
    }
  }

  private async maybeCreateRetroactiveRebate(
    clientAccountId: string,
    subagentId: string,
    newTier: CommissionVolumeTier,
    previousStatus: SubagentVolumeStatus,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<void> {
    const previousTier = previousStatus.currentTierId
      ? await this.prisma.commissionVolumeTier.findUnique({ where: { id: previousStatus.currentTierId } })
      : null;

    const bookings = await this.prisma.booking.findMany({
      where: {
        clientAccountId,
        status: { not: 'CANCELLED' },
        confirmedAt: { gte: periodStart, lte: periodEnd },
      },
      select: { totalPrice: true, currency: true },
    });
    if (bookings.length === 0) return;

    const currency = newTier.resultingCommissionCurrency ?? bookings[0].currency;
    const newPercentage = Number(newTier.resultingCommissionPercentage ?? 0);
    const oldPercentage = Number(previousStatus.effectiveCommissionPercentage ?? 0);
    const newFixed = Number(newTier.resultingCommissionFixedAmount ?? 0);
    const oldFixed = Number(previousTier?.resultingCommissionFixedAmount ?? 0);

    const percentagePart = bookings.reduce((sum, b) => sum + (b.totalPrice * (newPercentage - oldPercentage)) / 100, 0);
    const fixedPart = bookings.length * (newFixed - oldFixed);
    const rebateAmount = Math.round(percentagePart + fixedPart);

    if (rebateAmount <= 0) return; // §3.2 formula — samo pozitivna korist za subagenta se knjiži kao rabat

    await this.rebates.createDraft({
      subagentId,
      triggeringTierId: newTier.id,
      periodStart,
      periodEnd,
      calculatedAmount: rebateAmount,
      currency,
    });
  }

  private periodBounds(period: CommissionVolumePeriod, now: Date): { start: Date; end: Date } {
    if (period === 'CALENDAR_QUARTER') {
      const quarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3;
      const start = new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999));
      return { start, end };
    }
    if (period === 'ROLLING_12_MONTHS') {
      return { start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), end: now };
    }
    // CALENDAR_YEAR
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
      end: new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999)),
    };
  }

  private async computeMetric(clientAccountId: string, metric: CommissionVolumeMetric, since: Date, until: Date): Promise<number> {
    const bookingWhere = {
      clientAccountId,
      status: { not: 'CANCELLED' as const },
      confirmedAt: { gte: since, lte: until },
    };

    if (metric === 'BOOKING_COUNT') {
      return this.prisma.booking.count({ where: bookingWhere });
    }
    if (metric === 'TOTAL_SALES_RSD') {
      const agg = await this.prisma.booking.aggregate({ where: { ...bookingWhere, currency: 'RSD' }, _sum: { totalPrice: true } });
      return agg._sum.totalPrice ?? 0;
    }
    // NIGHT_COUNT
    const items = await this.prisma.bookingItem.findMany({
      where: { itemStatus: { not: 'CANCELLED' }, booking: bookingWhere },
      select: { stayFrom: true, stayTo: true },
    });
    return items.reduce((sum, i) => sum + Math.max(0, Math.round((i.stayTo.getTime() - i.stayFrom.getTime()) / 86_400_000)), 0);
  }
}
