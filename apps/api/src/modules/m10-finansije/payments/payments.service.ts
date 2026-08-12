import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { BookingsService } from '../../m5-rezervacije/bookings/bookings.service';
import { ConfirmQuoteDto } from '../../m5-rezervacije/bookings/dto/confirm-quote.dto';
import { ClientPaymentSchedulesService } from '../payment-terms/client-payment-schedules.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import type { PaymentGatewayAdapter } from '../adapters/payment-gateway-adapter.interface';
import { PAYMENT_GATEWAY_ADAPTER } from '../adapters/payment-gateway.token';

// M10 System actor — koristi se za automatske prelaze koje ne pokreće ljudski nalog
// (npr. CARD uplata preko webhook-a), isti obrazac kao "GOST_SELF" u M5 za samouslužne tokove.
const SYSTEM_ACTOR = { userId: 'M10_SYSTEM' };

// M10 spec §5.2 — praćenje naplate od gostiju; §7 — kartično plaćanje (hosted checkout).
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly bookings: BookingsService,
    private readonly clientPaymentSchedules: ClientPaymentSchedulesService,
    @Inject(PAYMENT_GATEWAY_ADAPTER) private readonly gateway: PaymentGatewayAdapter,
  ) {}

  async findAll(filters: { bookingId?: string }) {
    return this.prisma.payment.findMany({ where: { bookingId: filters.bookingId }, orderBy: { createdAt: 'desc' } });
  }

  // §5.2, §9 — ručan unos, samo BANK_TRANSFER/CASH; CARD se beleži isključivo preko webhook-a.
  async recordManualPayment(dto: RecordPaymentDto, actor: { userId: string }) {
    const booking = await this.prisma.booking.findUnique({ where: { id: dto.bookingId } });
    if (!booking) throw new NotFoundException(`Booking ${dto.bookingId} nije pronađen.`);

    const payment = await this.prisma.payment.create({
      data: {
        bookingId: dto.bookingId,
        amount: dto.amount,
        currency: dto.currency,
        method: dto.method,
        status: 'RECEIVED',
        reference: dto.reference,
        receivedAt: new Date(),
        recordedBy: actor.userId,
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M10',
      action: 'payment.recorded',
      resourceType: 'Payment',
      resourceId: payment.id,
      afterState: payment,
    });

    await this.onBookingPaymentReceived(dto.bookingId, actor);
    return payment;
  }

  // §7.2 korak 1 — pokreće hosted checkout za dati quote_id.
  async initiateCardPayment(quoteId: string, idempotencyKey: string) {
    const quote = await this.prisma.quote.findUnique({ where: { id: quoteId }, include: { items: true } });
    if (!quote) throw new NotFoundException(`Quote ${quoteId} nije pronađena.`);

    const amount = quote.items.reduce((sum, item) => sum + item.finalPrice, 0);
    const currency = quote.items[0]?.finalPriceCurrency ?? 'EUR';

    const result = await this.gateway.initiatePayment(amount, currency, idempotencyKey);

    const payment = await this.prisma.payment.create({
      data: {
        quoteId,
        amount,
        currency,
        method: 'CARD',
        status: 'PENDING',
        gatewayProvider: 'mock',
        gatewayTransactionId: result.gatewayTransactionId,
        gatewayIdempotencyKey: idempotencyKey,
      },
    });

    return { paymentId: payment.id, redirectUrl: result.redirectUrl, clientToken: result.clientToken };
  }

  // §7.2 koraci 2-5 — provajder potvrđuje naplatu; TEK SAD M5 pokreće potvrdu rezervacije
  // (sve ili ništa); ako potvrda ne uspe, automatski VOID + povraćaj, bez rezervacije koja "visi".
  async handleCardWebhook(gatewayTransactionId: string, confirmDto: ConfirmQuoteDto) {
    const payment = await this.prisma.payment.findFirst({ where: { gatewayTransactionId } });
    if (!payment) throw new NotFoundException(`Payment za gatewayTransactionId ${gatewayTransactionId} nije pronađen.`);
    if (payment.status !== 'PENDING') return payment; // idempotentno — webhook se može ponoviti

    const status = await this.gateway.getPaymentStatus(gatewayTransactionId);
    if (status.status !== 'SUCCESS') {
      const failed = await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      return failed;
    }

    const received = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'RECEIVED', receivedAt: new Date() }, // recordedBy ostaje null — automatski, ne ručno (§5.2)
    });

    try {
      // confirmQuote vraća M5 serializeBooking() rezultat (booking-visibility.ts) čiji tip
      // gubi index signature kroz spread — id svakako postoji na INTERNAL_PANEL kontekstu.
      const booking = (await this.bookings.confirmQuote(payment.quoteId!, confirmDto, SYSTEM_ACTOR)) as unknown as { id: string };
      const updated = await this.prisma.payment.update({ where: { id: received.id }, data: { bookingId: booking.id } });
      // Kartica pokriva pun iznos rezervacije (isti items → isti total_price) — ovaj poziv
      // postavlja Booking.payment_status = PAID, što je i M5 okidač za vaučer (§5.2).
      await this.onBookingPaymentReceived(booking.id, SYSTEM_ACTOR);
      return updated;
    } catch (err) {
      // §7.2 korak 5 — potvrda rezervacije nije uspela (npr. kapacitet u međuvremenu prodat).
      await this.gateway.refundOrVoid(gatewayTransactionId, payment.amount);
      return this.prisma.payment.update({ where: { id: received.id }, data: { status: 'VOIDED' } });
    }
  }

  // §5.2 — kad zbir RECEIVED dostigne Booking.total_price, M10 javlja M5 PAID (što je i okidač
  // za vaučer u M5); delimičan iznos → PARTIALLY_PAID. Takođe ažurira ClientPaymentSchedule (§5.4.3).
  private async onBookingPaymentReceived(bookingId: string, actor: { userId: string }) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return;

    const sum = await this.prisma.payment.aggregate({ where: { bookingId, status: 'RECEIVED' }, _sum: { amount: true } });
    const received = sum._sum.amount ?? 0;

    if (received >= booking.totalPrice && booking.paymentStatus !== 'PAID') {
      await this.bookings.updatePaymentStatus(bookingId, 'PAID', actor);
    } else if (received > 0 && received < booking.totalPrice && booking.paymentStatus === 'UNPAID') {
      await this.bookings.updatePaymentStatus(bookingId, 'PARTIALLY_PAID', actor);
    }

    await this.clientPaymentSchedules.onPaymentReceived(bookingId);
  }
}
