import { Injectable } from '@nestjs/common';
import { LoyaltyQualificationMetric, LoyaltyQualificationPeriod, LoyaltyTier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';

/**
 * M6 spec §3.2 — automatski preračun nivoa lojalnosti po `booking.confirmed`/`booking.cancelled`
 * (M5 Event Bus), i ručni override koji uvek pobeđuje nad automatski izračunatim nivoom.
 *
 * Implementaciona napomena (mehanička dopuna, avgust 2026): spec ne definiše tačnu formulu za
 * `calculated_metric_value` po tipu metrike — ovde je odabrano: `TOTAL_SPEND_RSD` sabira
 * `Booking.total_price` isključivo za rezervacije u valuti RSD (konverzija drugih valuta nije
 * definisana ovim modulom), `BOOKING_COUNT` broji ne-otkazane rezervacije, `NIGHT_COUNT` sabira
 * broj noćenja (`stay_to - stay_from`) preko ne-otkazanih `BookingItem` stavki. Period se
 * primenjuje na `Booking.confirmed_at`.
 */
@Injectable()
export class ClientLoyaltyStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async get(clientAccountId: string) {
    const status = await this.prisma.clientLoyaltyStatus.findUnique({
      where: { clientAccountId },
      include: { currentTier: true, manualOverrideTier: true },
    });
    if (!status) {
      return {
        clientAccountId,
        currentTierId: null,
        manualOverrideTierId: null,
        effectiveTierId: null,
        discountPercentage: 0,
        calculatedMetricValue: 0,
      };
    }
    const effectiveTier = status.manualOverrideTier ?? status.currentTier;
    return {
      ...status,
      effectiveTierId: effectiveTier?.id ?? null,
      discountPercentage: effectiveTier ? Number(effectiveTier.discountPercentage) : 0,
    };
  }

  // §3.2 — poziva se iz M6EventSubscribersService na booking.confirmed/booking.cancelled.
  async recalculate(clientAccountId: string) {
    const tiers = await this.prisma.loyaltyTier.findMany({ orderBy: { rank: 'desc' } });

    let matchedTier: LoyaltyTier | null = null;
    let metricValue = 0;
    for (const tier of tiers) {
      const value = await this.computeMetric(clientAccountId, tier.qualificationMetric, tier.qualificationPeriod);
      if (value >= Number(tier.threshold)) {
        matchedTier = tier;
        metricValue = value;
        break;
      }
    }
    if (!matchedTier && tiers.length > 0) {
      const lowest = tiers[tiers.length - 1];
      metricValue = await this.computeMetric(clientAccountId, lowest.qualificationMetric, lowest.qualificationPeriod);
    }

    const existing = await this.prisma.clientLoyaltyStatus.findUnique({ where: { clientAccountId } });
    const tierChanged = (existing?.currentTierId ?? null) !== (matchedTier?.id ?? null);

    return this.prisma.clientLoyaltyStatus.upsert({
      where: { clientAccountId },
      create: {
        clientAccountId,
        currentTierId: matchedTier?.id ?? null,
        calculatedMetricValue: metricValue,
        tierSince: matchedTier ? new Date() : null,
        lastRecalculatedAt: new Date(),
      },
      update: {
        currentTierId: matchedTier?.id ?? null,
        calculatedMetricValue: metricValue,
        tierSince: tierChanged ? new Date() : existing?.tierSince,
        lastRecalculatedAt: new Date(),
      },
    });
  }

  // §3.2 — ručni override, obavezan razlog, uvek pobeđuje nad automatski izračunatim nivoom.
  async override(clientAccountId: string, tierId: string, reason: string, actor: { userId: string }) {
    const before = await this.prisma.clientLoyaltyStatus.findUnique({ where: { clientAccountId } });

    const updated = await this.prisma.clientLoyaltyStatus.upsert({
      where: { clientAccountId },
      create: {
        clientAccountId,
        calculatedMetricValue: 0,
        manualOverrideTierId: tierId,
        manualOverrideReason: reason,
        manualOverrideBy: actor.userId,
      },
      update: {
        manualOverrideTierId: tierId,
        manualOverrideReason: reason,
        manualOverrideBy: actor.userId,
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M6',
      action: 'loyalty_status.manual_override',
      resourceType: 'ClientLoyaltyStatus',
      resourceId: updated.id,
      beforeState: before ?? undefined,
      afterState: updated,
    });

    return updated;
  }

  private periodStart(period: LoyaltyQualificationPeriod): Date | null {
    const now = new Date();
    if (period === 'ROLLING_12_MONTHS') return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    if (period === 'CALENDAR_YEAR') return new Date(now.getFullYear(), 0, 1);
    return null; // LIFETIME
  }

  private async computeMetric(
    clientAccountId: string,
    metric: LoyaltyQualificationMetric,
    period: LoyaltyQualificationPeriod,
  ): Promise<number> {
    const since = this.periodStart(period);
    const bookingWhere = {
      clientAccountId,
      status: { not: 'CANCELLED' as const },
      ...(since ? { confirmedAt: { gte: since } } : {}),
    };

    if (metric === 'BOOKING_COUNT') {
      return this.prisma.booking.count({ where: bookingWhere });
    }
    if (metric === 'TOTAL_SPEND_RSD') {
      const agg = await this.prisma.booking.aggregate({
        where: { ...bookingWhere, currency: 'RSD' },
        _sum: { totalPrice: true },
      });
      return (agg._sum.totalPrice ?? 0) / 100;
    }
    // NIGHT_COUNT
    const items = await this.prisma.bookingItem.findMany({
      where: { itemStatus: { not: 'CANCELLED' }, booking: bookingWhere },
      select: { stayFrom: true, stayTo: true },
    });
    return items.reduce((sum, i) => sum + Math.max(0, Math.round((i.stayTo.getTime() - i.stayFrom.getTime()) / 86_400_000)), 0);
  }
}
