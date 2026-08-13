import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { FactSyncService } from '../sync/fact-sync.service';

export interface ReconciliationResult {
  bookingsChecked: number;
  bookingsCorrected: number;
  bookingsRemoved: number;
  paymentsChecked: number;
  paymentsRemoved: number;
  ranAt: Date;
}

// M13 spec §2 — "noćni posao rekonsilijacije koja povlači stanje direktno preko API-ja izvornih
// modula ... i upoređuje sa projekcijom M13, ispravljajući odstupanja". FactSyncService.syncBookingItem
// je već idempotentan upsert (poredi implicitno preko upsert-a) — ovde se dodaje eksplicitno brojanje
// šta je ZAISTA izmenjeno (za e2e proveru izlaznog kriterijuma "gubitak pojedinačnog događaja se
// ispravlja narednom noćnom rekonsilijacijom") i čišćenje projektovanih redova čiji izvor u M5/M10
// više ne postoji ili više ne kvalifikuje (npr. RECEIVED uplata koja je posle storno postala VOIDED).
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly factSync: FactSyncService,
  ) {}

  // Vreme namerno van radnog vremena tima (M14 alarmi koriste 6h, M13 rekonsilijacija ide
  // pre toga da izveštaji budu sveži kad tim počne dan).
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runNightly(): Promise<void> {
    await this.reconcile();
  }

  async reconcile(): Promise<ReconciliationResult> {
    const ranAt = new Date();

    const items = await this.prisma.bookingItem.findMany({ select: { id: true } });
    const currentItemIds = new Set(items.map((i) => i.id));

    let bookingsCorrected = 0;
    for (const item of items) {
      const before = await this.prisma.factBooking.findUnique({ where: { bookingItemId: item.id } });
      await this.factSync.syncBookingItem(item.id);
      const after = await this.prisma.factBooking.findUnique({ where: { bookingItemId: item.id } });
      if (!before || this.factBookingChanged(before, after)) bookingsCorrected++;
    }

    // Orphan cleanup — FactBooking redovi čiji izvorni BookingItem više ne postoji u M5.
    const existingFactBookings = await this.prisma.factBooking.findMany({ select: { bookingItemId: true } });
    const orphanBookingIds = existingFactBookings
      .map((f) => f.bookingItemId)
      .filter((id) => !currentItemIds.has(id));
    if (orphanBookingIds.length > 0) {
      await this.prisma.factBooking.deleteMany({ where: { bookingItemId: { in: orphanBookingIds } } });
    }

    // FactPayment — resinhronizuj sve trenutno RECEIVED uplate i ukloni projektovane redove
    // čija izvorna uplata više nije RECEIVED (syncPayment sam briše u tom slučaju).
    const allPayments = await this.prisma.payment.findMany({ select: { id: true, status: true } });
    for (const payment of allPayments) {
      await this.factSync.syncPayment(payment.id);
    }
    const currentReceivedIds = new Set(allPayments.filter((p) => p.status === 'RECEIVED').map((p) => p.id));
    const existingFactPayments = await this.prisma.factPayment.findMany({ select: { paymentId: true } });
    const paymentsRemoved = existingFactPayments.filter((f) => !currentReceivedIds.has(f.paymentId)).length;

    const result: ReconciliationResult = {
      bookingsChecked: items.length,
      bookingsCorrected,
      bookingsRemoved: orphanBookingIds.length,
      paymentsChecked: allPayments.length,
      paymentsRemoved,
      ranAt,
    };
    this.logger.log(
      `Rekonsilijacija završena: ${bookingsCorrected}/${items.length} FactBooking redova ispravljeno, ${orphanBookingIds.length} uklonjeno; FactPayment ${paymentsRemoved} uklonjeno.`,
    );
    return result;
  }

  private factBookingChanged(
    before: Record<string, unknown>,
    after: Record<string, unknown> | null,
  ): boolean {
    if (!after) return true;
    const ignore = new Set(['lastSyncedAt', 'id']);
    for (const key of Object.keys(after)) {
      if (ignore.has(key)) continue;
      if (String(before[key]) !== String(after[key])) return true;
    }
    return false;
  }
}
