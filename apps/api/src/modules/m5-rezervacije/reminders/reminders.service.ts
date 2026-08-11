import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventBusService } from '../../../common/events/event-bus.service';

const SUPPLIER_CONFIRMATION_THRESHOLD_HOURS = 48; // §6.1, podrazumevano
const UNANNOUNCED_STAY_THRESHOLD_DAYS = 7; // §6.1, problem #2
const ANNOUNCED_WITHOUT_CONFIRMATION_THRESHOLD_DAYS = 5; // §6.1, problem #2

/**
 * M5 spec §6.1 — "praćenje posle potvrde: podsetnici i alarmi." Nivo "Autonomno" (Master
 * dokument poglavlje 7) — čisto informativno, NIKAD ne menja/blokira stanje rezervacije.
 * Objavljuje se preko Event Bus-a (isti obrazac kao M3 §4.3 low_capacity_critical) — M17
 * Agent Inbox se pretplaćuje kad taj prikaz bude izgrađen; email kopija Vlasniku/Direktoru
 * za treću/četvrtu stavku takođe čeka stvaran email-slanje sloj (M22) — dokumentovano
 * ograničenje, isti princip kao ostali TODO stub hook-ovi u ovom modulu.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDailyChecks() {
    await Promise.all([
      this.checkUnpaidWithVoucherOverride(),
      this.checkOpenSupplierConfirmations(),
      this.checkVoucherMissingDespitePaid(),
      this.checkUnannouncedBeforeStay(),
      this.checkAnnouncedWithoutSupplierConfirmation(),
    ]);
  }

  // §6.1, alarm 1 — neplaćena rezervacija sa izdatim vaučerom (override).
  async checkUnpaidWithVoucherOverride() {
    const bookings = await this.prisma.booking.findMany({
      where: { voucherOverrideApprovedBy: { not: null }, paymentStatus: { not: 'PAID' }, status: { not: 'CANCELLED' } },
      select: { id: true, bookingNumber: true, paymentStatus: true },
    });
    for (const b of bookings) {
      await this.eventBus.emit('M5', 'reminder.unpaid_with_voucher_override', { bookingId: b.id, bookingNumber: b.bookingNumber });
    }
    return bookings.length;
  }

  // §6.1, alarm 2 — otvorena potvrda dobavljača, po stavci (ne po celoj rezervaciji).
  async checkOpenSupplierConfirmations() {
    const threshold = new Date(Date.now() - SUPPLIER_CONFIRMATION_THRESHOLD_HOURS * 60 * 60 * 1000);
    const items = await this.prisma.bookingItem.findMany({
      where: { itemStatus: 'PENDING_SUPPLIER_CONFIRMATION', announcedAt: { lte: threshold }, supplierConfirmedAt: null },
      select: { id: true, bookingId: true, productId: true },
    });
    for (const item of items) {
      await this.eventBus.emit('M5', 'reminder.open_supplier_confirmation', { bookingItemId: item.id, bookingId: item.bookingId, productId: item.productId });
    }
    return items.length;
  }

  // §6.1, alarm 3 — vaučer nedostaje uprkos punoj uplati (greška u sistemu).
  async checkVoucherMissingDespitePaid() {
    const bookings = await this.prisma.booking.findMany({
      where: { paymentStatus: 'PAID', voucherUrl: null, status: { not: 'CANCELLED' } },
      select: { id: true, bookingNumber: true },
    });
    for (const b of bookings) {
      this.logger.error(`Vaučer nedostaje za rezervaciju ${b.bookingNumber} uprkos punoj uplati (M5 spec §6.1) — sistemska greška.`);
      await this.eventBus.emit('M5', 'reminder.voucher_missing_despite_paid', { bookingId: b.id, bookingNumber: b.bookingNumber, severity: 'CRITICAL' });
    }
    return bookings.length;
  }

  // §6.1, alarm 4 — nenajavljena stavka pred boravak (problem #2), hitniji od ostalih.
  async checkUnannouncedBeforeStay() {
    const horizon = new Date(Date.now() + UNANNOUNCED_STAY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
    const items = await this.prisma.bookingItem.findMany({
      where: { sourceType: 'CONTRACTED', itemStatus: 'CONFIRMED', announcedAt: null, stayFrom: { lte: horizon, gte: new Date() } },
      select: { id: true, bookingId: true, stayFrom: true },
    });
    for (const item of items) {
      await this.eventBus.emit('M5', 'reminder.unannounced_before_stay', { bookingItemId: item.id, bookingId: item.bookingId, stayFrom: item.stayFrom, severity: 'HIGH' });
    }
    return items.length;
  }

  // §6.1, alarm 5 — najava bez potvrde dobavljača (problem #2), niži prioritet.
  async checkAnnouncedWithoutSupplierConfirmation() {
    const threshold = new Date(Date.now() - ANNOUNCED_WITHOUT_CONFIRMATION_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
    const items = await this.prisma.bookingItem.findMany({
      where: { announcedAt: { lte: threshold }, supplierConfirmedAt: null, itemStatus: { not: 'CANCELLED' } },
      select: { id: true, bookingId: true },
    });
    for (const item of items) {
      await this.eventBus.emit('M5', 'reminder.announced_without_confirmation', { bookingItemId: item.id, bookingId: item.bookingId });
    }
    return items.length;
  }
}
