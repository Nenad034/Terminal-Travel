import { PaymentsService } from './payments.service';

describe('PaymentsService (M10 spec §5.2/§7)', () => {
  function makeService() {
    const prisma: any = {
      booking: { findUnique: jest.fn() },
      quote: { findUnique: jest.fn() },
      payment: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const bookings = { confirmQuote: jest.fn(), updatePaymentStatus: jest.fn() };
    const clientPaymentSchedules = { onPaymentReceived: jest.fn() };
    const gateway = { initiatePayment: jest.fn(), getPaymentStatus: jest.fn(), refundOrVoid: jest.fn() };
    const service = new PaymentsService(prisma, auditLog as any, bookings as any, clientPaymentSchedules as any, gateway as any);
    return { service, prisma, auditLog, bookings, clientPaymentSchedules, gateway };
  }

  describe('recordManualPayment (§5.2)', () => {
    it('poziva M5 updatePaymentStatus(PAID) čim zbir RECEIVED dostigne total_price', async () => {
      const { service, prisma, bookings, clientPaymentSchedules } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', totalPrice: 100000, paymentStatus: 'UNPAID' });
      prisma.payment.create.mockResolvedValue({ id: 'pay-1', bookingId: 'booking-1', amount: 100000 });
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 100000 } });

      await service.recordManualPayment(
        { bookingId: 'booking-1', amount: 100000, currency: 'EUR', method: 'BANK_TRANSFER' },
        { userId: 'actor-1' },
      );

      expect(bookings.updatePaymentStatus).toHaveBeenCalledWith('booking-1', 'PAID', { userId: 'actor-1' });
      expect(clientPaymentSchedules.onPaymentReceived).toHaveBeenCalledWith('booking-1');
    });

    it('poziva PARTIALLY_PAID kad zbir ne dostiže total_price', async () => {
      const { service, prisma, bookings } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', totalPrice: 100000, paymentStatus: 'UNPAID' });
      prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 30000 } });

      await service.recordManualPayment(
        { bookingId: 'booking-1', amount: 30000, currency: 'EUR', method: 'CASH' },
        { userId: 'actor-1' },
      );

      expect(bookings.updatePaymentStatus).toHaveBeenCalledWith('booking-1', 'PARTIALLY_PAID', { userId: 'actor-1' });
    });
  });

  describe('handleCardWebhook (§7.2)', () => {
    it('kad M5 potvrda uspe: popunjava booking_id i postavlja PAID', async () => {
      const { service, prisma, bookings, gateway } = makeService();
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        status: 'PENDING',
        quoteId: 'quote-1',
        amount: 100000,
      });
      gateway.getPaymentStatus.mockResolvedValue({ status: 'SUCCESS', capturedAmount: 100000 });
      prisma.payment.update
        .mockResolvedValueOnce({ id: 'pay-1', status: 'RECEIVED' }) // prvi update -> RECEIVED
        .mockResolvedValueOnce({ id: 'pay-1', status: 'RECEIVED', bookingId: 'booking-1' }); // drugi -> bookingId
      bookings.confirmQuote.mockResolvedValue({ id: 'booking-1', totalPrice: 100000 });
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', totalPrice: 100000, paymentStatus: 'UNPAID' });
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 100000 } });

      const result = await service.handleCardWebhook('mock-txn-1', {
        buyerName: 'Petar P.',
        buyerType: 'FIZICKO_LICE',
      } as any);

      expect(bookings.confirmQuote).toHaveBeenCalled();
      expect(bookings.updatePaymentStatus).toHaveBeenCalledWith('booking-1', 'PAID', { userId: 'M10_SYSTEM' });
      expect(gateway.refundOrVoid).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'pay-1', status: 'RECEIVED', bookingId: 'booking-1' });
    });

    it('kad M5 potvrda ne uspe: VOID + refundOrVoid, gost dobija povraćaj, poziv baca grešku (M8 izlazni kriterijum — jasna poruka, ne tiha "uspešna" VOID)', async () => {
      const { service, prisma, bookings, gateway } = makeService();
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1', status: 'PENDING', quoteId: 'quote-1', amount: 100000 });
      gateway.getPaymentStatus.mockResolvedValue({ status: 'SUCCESS', capturedAmount: 100000 });
      prisma.payment.update
        .mockResolvedValueOnce({ id: 'pay-1', status: 'RECEIVED' })
        .mockResolvedValueOnce({ id: 'pay-1', status: 'VOIDED' });
      bookings.confirmQuote.mockRejectedValue(new Error('Nema dovoljno preostalog kapaciteta'));

      await expect(
        service.handleCardWebhook('mock-txn-1', { buyerName: 'X', buyerType: 'FIZICKO_LICE' } as any),
      ).rejects.toThrow('Plaćanje je uspelo, ali potvrda rezervacije nije');

      expect(gateway.refundOrVoid).toHaveBeenCalledWith('mock-txn-1', 100000);
      // §7.2 — DB stanje i dalje mora biti VOIDED (drugi update poziv), bez obzira što se sad baca greška.
      expect(prisma.payment.update).toHaveBeenNthCalledWith(2, { where: { id: 'pay-1' }, data: { status: 'VOIDED' } });
    });

    it('kad provajder odbije naplatu (status !== SUCCESS): FAILED, poziv baca grešku', async () => {
      const { service, prisma, bookings, gateway } = makeService();
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1', status: 'PENDING', quoteId: 'quote-1', amount: 100000 });
      gateway.getPaymentStatus.mockResolvedValue({ status: 'DECLINED' });
      prisma.payment.update.mockResolvedValueOnce({ id: 'pay-1', status: 'FAILED' });

      await expect(
        service.handleCardWebhook('mock-txn-1', { buyerName: 'X', buyerType: 'FIZICKO_LICE' } as any),
      ).rejects.toThrow('Kartično plaćanje nije uspelo');

      expect(bookings.confirmQuote).not.toHaveBeenCalled();
      expect(prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'pay-1' }, data: { status: 'FAILED' } });
    });

    it('je idempotentno — ponovljen webhook za već obrađenu uplatu ne dupli logiku', async () => {
      const { service, prisma, gateway } = makeService();
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1', status: 'RECEIVED' });

      const result = await service.handleCardWebhook('mock-txn-1', { buyerName: 'X', buyerType: 'FIZICKO_LICE' } as any);

      expect(gateway.getPaymentStatus).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'pay-1', status: 'RECEIVED' });
    });
  });
});
