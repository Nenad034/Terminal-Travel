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
    return this.prisma.payment.findMany({
      where: { bookingId: filters.bookingId },
      orderBy: { createdAt: 'desc' },
      include: { bank: true, checkDetails: { include: { bank: true } } },
    });
  }

  // §5.2, §9 — ručan unos; CARD (webhook) se beleži isključivo preko /payments/card/*.
  // Dopuna (2.9.2026, na zahtev vlasnika) — CARD_MANUAL/CHECK/ADMINISTRATIVE_BAN dodati; zbir
  // `checkDetails` (specifikacija čekova) mora pokrivati ceo `amount` — provera ovde, ne u DTO-u
  // (zahteva zbir preko niza), da ne bude moguće upisati specifikaciju koja se ne slaže sa
  // stvarno primljenom uplatom (ista "istina mora biti proverljiva" logika kao svuda u M10).
  async recordManualPayment(dto: RecordPaymentDto, actor: { userId: string }) {
    const booking = await this.prisma.booking.findUnique({ where: { id: dto.bookingId } });
    if (!booking) throw new NotFoundException(`Booking ${dto.bookingId} nije pronađen.`);

    if (dto.method === 'CHECK') {
      const sum = (dto.checkDetails ?? []).reduce((s, c) => s + c.amount, 0);
      if (sum !== dto.amount) {
        throw new BadRequestException(
          `Zbir specifikacije čekova (${sum}) mora biti jednak iznosu uplate (${dto.amount}).`,
        );
      }
    }

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
        bankId: dto.bankId,
        checkDetails:
          dto.method === 'CHECK' && dto.checkDetails
            ? {
                create: dto.checkDetails.map((c) => ({
                  bankId: c.bankId,
                  amount: c.amount,
                  checkNumber: c.checkNumber,
                  clearanceDate: new Date(c.clearanceDate),
                })),
              }
            : undefined,
      },
      include: { checkDetails: true, bank: true },
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

    // gatewayTransactionId se vraća pozivaocu SAMO zato što mock gateway (§7.1) nema stvaran
    // hostovani checkout — dok se PSP ne izabere (§12), M8 sam simulira korak provajdera i
    // odmah poziva /card/webhook sa istim ID-jem (vidi M8 rezervacija/actions.ts). Stvaran
    // provajder ovo polje ne bi trebalo da otkriva klijentu — ukloniti kad hostovani checkout
    // zameni ovu privremenu simulaciju.
    return {
      paymentId: payment.id,
      redirectUrl: result.redirectUrl,
      clientToken: result.clientToken,
      gatewayTransactionId: result.gatewayTransactionId,
    };
  }

  // §7.2 koraci 2-5 — provajder potvrđuje naplatu; TEK SAD M5 pokreće potvrdu rezervacije
  // (sve ili ništa); ako potvrda ne uspe, automatski VOID + povraćaj, bez rezervacije koja "visi".
  //
  // Ispravka avgust 2026 (M8 izlazni kriterijum, otkriveno pri live-proveri neuspelog toka
  // plaćanja) — obe grane neuspeha su ranije VRAĆALE 200/201 sa ažuriranim Payment zapisom
  // (FAILED/VOIDED) umesto da bace grešku. `apps/web` (rezervacija/actions.ts payByCardAction)
  // ima catch(ApiError) koji prikazuje jasnu poruku gostu (`greska=1` na /rezervacija/placanje) —
  // taj catch se NIKAD nije aktivirao jer apiFetch baca ApiError samo na ne-2xx odgovor. Gost bi
  // umesto poruke bio preusmeren na /rezervacija/potvrda?bookingId=undefined (Payment nema
  // booking_id polje u ovom slučaju), prazna/zbunjujuća stranica — suprotno izlaznom kriterijumu
  // "gost nikad ne ostaje bez jasne poruke". Ispravka: baci BadRequestException posle ažuriranja
  // Payment statusa — DB stanje ostaje isto (FAILED/VOIDED, refundOrVoid pozvan), samo se
  // neuspeh sad i signalizira pozivaocu.
  async handleCardWebhook(gatewayTransactionId: string, confirmDto: ConfirmQuoteDto) {
    const payment = await this.prisma.payment.findFirst({ where: { gatewayTransactionId } });
    if (!payment) throw new NotFoundException(`Payment za gatewayTransactionId ${gatewayTransactionId} nije pronađen.`);
    if (payment.status !== 'PENDING') return payment; // idempotentno — webhook se može ponoviti

    const status = await this.gateway.getPaymentStatus(gatewayTransactionId);
    if (status.status !== 'SUCCESS') {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      throw new BadRequestException('Kartično plaćanje nije uspelo kod provajdera — rezervacija nije napravljena, iznos nije naplaćen.');
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
      await this.prisma.payment.update({ where: { id: received.id }, data: { status: 'VOIDED' } });
      throw new BadRequestException(
        'Plaćanje je uspelo, ali potvrda rezervacije nije (kapacitet više nije dostupan) — iznos je automatski vraćen.',
      );
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
