import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

describe('PaymentsService (M10 spec §5.2/§7)', () => {
  function makeService() {
    const prisma: any = {
      booking: { findUnique: jest.fn() },
      quote: { findUnique: jest.fn() },
      payment: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
      fiscalDocument: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      paymentCheckDetail: { deleteMany: jest.fn() },
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

    // Dopuna (2.9.2026, na zahtev vlasnika — CARD_MANUAL/CHECK/ADMINISTRATIVE_BAN + banka +
    // specifikacija čekova).
    it('CHECK — upisuje specifikaciju čekova kad se zbir poklapa sa iznosom', async () => {
      const { service, prisma } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', totalPrice: 30000, paymentStatus: 'UNPAID' });
      prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 30000 } });

      await service.recordManualPayment(
        {
          bookingId: 'booking-1',
          amount: 30000,
          currency: 'EUR',
          method: 'CHECK',
          checkDetails: [
            { bankId: 'bank-1', amount: 20000, checkNumber: 'CK-1', clearanceDate: '2027-01-10' },
            { bankId: 'bank-2', amount: 10000, checkNumber: 'CK-2', clearanceDate: '2027-02-10' },
          ],
        } as any,
        { userId: 'actor-1' },
      );

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            method: 'CHECK',
            checkDetails: {
              create: [
                { bankId: 'bank-1', amount: 20000, checkNumber: 'CK-1', clearanceDate: new Date('2027-01-10') },
                { bankId: 'bank-2', amount: 10000, checkNumber: 'CK-2', clearanceDate: new Date('2027-02-10') },
              ],
            },
          }),
        }),
      );
    });

    it('CHECK — odbija kad se zbir specifikacije ne poklapa sa iznosom uplate', async () => {
      const { service, prisma } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', totalPrice: 30000, paymentStatus: 'UNPAID' });

      await expect(
        service.recordManualPayment(
          {
            bookingId: 'booking-1',
            amount: 30000,
            currency: 'EUR',
            method: 'CHECK',
            checkDetails: [{ bankId: 'bank-1', amount: 10000, checkNumber: 'CK-1', clearanceDate: '2027-01-10' }],
          } as any,
          { userId: 'actor-1' },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('BANK_TRANSFER/CARD_MANUAL — prosleđuje bankId na Payment', async () => {
      const { service, prisma } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', totalPrice: 30000, paymentStatus: 'UNPAID' });
      prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 30000 } });

      await service.recordManualPayment(
        { bookingId: 'booking-1', amount: 30000, currency: 'EUR', method: 'CARD_MANUAL', bankId: 'bank-1' } as any,
        { userId: 'actor-1' },
      );

      expect(prisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ bankId: 'bank-1' }) }));
    });
  });

  // Dopuna (2.9.2026, na zahtev vlasnika — pregled/štampa specifikacije čekova).
  describe('findOne (§5.2 dopuna 2.9.2026)', () => {
    it('vraća uplatu sa bankom, specifikacijom čekova i rezervacijom', async () => {
      const { service, prisma } = makeService();
      prisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', method: 'CHECK', checkDetails: [{ id: 'c1' }], booking: { bookingNumber: 'TT-1' } });

      const result = await service.findOne('pay-1');

      expect(prisma.payment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'pay-1' } }),
      );
      expect(result.id).toBe('pay-1');
    });

    it('baca 404 kad uplata ne postoji', async () => {
      const { service, prisma } = makeService();
      prisma.payment.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nepostojeca')).rejects.toThrow(NotFoundException);
    });
  });

  // Dopuna (2.9.2026, na zahtev vlasnika — korekcija ručno unete uplate, sve u audit logu;
  // blokirano čim je fiskalni dokument za tu rezervaciju SUBMITTED/ISSUED).
  describe('updateManualPayment (§5.2 dopuna 2.9.2026)', () => {
    function existingPayment(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        id: 'pay-1',
        bookingId: 'booking-1',
        method: 'BANK_TRANSFER',
        amount: 10000,
        currency: 'EUR',
        checkDetails: [],
        ...overrides,
      };
    }

    it('menja uplatu i upisuje audit trag sa pre/posle stanjem', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.payment.findUnique.mockResolvedValue(existingPayment());
      prisma.payment.update.mockResolvedValue({ id: 'pay-1', amount: 12000 });
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', totalPrice: 12000, paymentStatus: 'UNPAID' });
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 12000 } });

      await service.updateManualPayment('pay-1', { amount: 12000, currency: 'EUR', method: 'BANK_TRANSFER', bankId: 'bank-1' } as any, {
        userId: 'actor-1',
      });

      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'payment.updated', resourceId: 'pay-1', beforeState: expect.objectContaining({ amount: 10000 }) }),
      );
      expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amount: 12000, bankId: 'bank-1' }) }));
    });

    it('odbija izmenu CARD uplate (automatski webhook tok)', async () => {
      const { service, prisma } = makeService();
      prisma.payment.findUnique.mockResolvedValue(existingPayment({ method: 'CARD' }));

      await expect(
        service.updateManualPayment('pay-1', { amount: 10000, currency: 'EUR', method: 'CASH' } as any, { userId: 'actor-1' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('odbija izmenu kad je fiskalni dokument za rezervaciju već SUBMITTED', async () => {
      const { service, prisma } = makeService();
      prisma.payment.findUnique.mockResolvedValue(existingPayment());
      prisma.fiscalDocument.findFirst.mockResolvedValue({ id: 'fd-1', status: 'SUBMITTED' });

      await expect(
        service.updateManualPayment('pay-1', { amount: 10000, currency: 'EUR', method: 'CASH' } as any, { userId: 'actor-1' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('DOZVOLJENO kad postoji samo DRAFT fiskalni dokument (nije poslat/izdat)', async () => {
      const { service, prisma } = makeService();
      prisma.payment.findUnique.mockResolvedValue(existingPayment());
      prisma.fiscalDocument.findFirst.mockResolvedValue(null); // findFirst već filtrira na SUBMITTED/ISSUED
      prisma.payment.update.mockResolvedValue({ id: 'pay-1' });
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', totalPrice: 10000, paymentStatus: 'UNPAID' });
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 10000 } });

      await expect(
        service.updateManualPayment('pay-1', { amount: 10000, currency: 'EUR', method: 'CASH' } as any, { userId: 'actor-1' }),
      ).resolves.toBeDefined();
    });

    it('CHECK — odbija kad se zbir specifikacije ne poklapa, briše staru specifikaciju pre nove kad se poklapa', async () => {
      const { service, prisma } = makeService();
      prisma.payment.findUnique.mockResolvedValue(existingPayment({ method: 'CHECK', checkDetails: [{ id: 'old-1' }] }));

      await expect(
        service.updateManualPayment(
          'pay-1',
          { amount: 10000, currency: 'EUR', method: 'CHECK', checkDetails: [{ bankId: 'b1', amount: 5000, checkNumber: 'X', clearanceDate: '2027-01-01' }] } as any,
          { userId: 'actor-1' },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.paymentCheckDetail.deleteMany).not.toHaveBeenCalled();
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
