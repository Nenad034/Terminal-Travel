import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventBusService } from '../../../common/events/event-bus.service';

// M10 spec §5.3 — read-only provera Booking → Payment → FiscalDocument, čisto informativno,
// ne menja nijedan zapis. Broj dana za "predugo delimično plaćeno" nije eksplicitno naveden u
// spec-u (za razliku od 24h u §6.2 ili 5 dana u §8.2) — podrazumevano 14, razumna vrednost dok
// se ne pokaže drugačija potreba u praksi.
const DEFAULT_PARTIAL_PAYMENT_STALE_DAYS = 14;

export type ReconciliationMismatchReason = 'MISSING_FISCAL_DOCUMENT' | 'PARTIAL_PAYMENT_STALE';

export interface ReconciliationMismatch {
  bookingId: string;
  reason: ReconciliationMismatchReason;
}

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async findMismatches(staleDays = DEFAULT_PARTIAL_PAYMENT_STALE_DAYS): Promise<ReconciliationMismatch[]> {
    const confirmedBookings = await this.prisma.booking.findMany({
      where: { status: 'CONFIRMED' },
      include: { fiscalDocuments: true },
    });

    const mismatches: ReconciliationMismatch[] = [];
    const now = Date.now();

    for (const booking of confirmedBookings) {
      const paidSum = await this.sumReceivedPayments(booking.id);
      const hasActiveFiscalDocument = booking.fiscalDocuments.some((d) => d.status === 'ISSUED' || d.status === 'SUBMITTED');

      if (paidSum >= booking.totalPrice && !hasActiveFiscalDocument) {
        mismatches.push({ bookingId: booking.id, reason: 'MISSING_FISCAL_DOCUMENT' });
        continue;
      }

      if (paidSum > 0 && paidSum < booking.totalPrice) {
        const daysSinceConfirmed = booking.confirmedAt ? (now - booking.confirmedAt.getTime()) / (24 * 60 * 60 * 1000) : 0;
        if (daysSinceConfirmed >= staleDays) {
          mismatches.push({ bookingId: booking.id, reason: 'PARTIAL_PAYMENT_STALE' });
        }
      }
    }

    return mismatches;
  }

  // Poziva se periodično (@Cron) — generiše HealthSignal preko Event Bus-a za svaku
  // neusklađenost (M18 još ne postoji kao model, isti obrazac kao ostali M10 alarmi).
  async checkAndEmitSignals(): Promise<void> {
    const mismatches = await this.findMismatches();
    for (const mismatch of mismatches) {
      await this.eventBus.emit('M10', 'reconciliation_mismatch', { ...mismatch });
    }
  }

  private async sumReceivedPayments(bookingId: string): Promise<number> {
    const result = await this.prisma.payment.aggregate({ where: { bookingId, status: 'RECEIVED' }, _sum: { amount: true } });
    return result._sum.amount ?? 0;
  }
}
