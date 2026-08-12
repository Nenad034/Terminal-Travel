import { ClientPaymentSchedulesService } from './client-payment-schedules.service';

describe('ClientPaymentSchedulesService (M10 spec §5.4.2/§5.4.3)', () => {
  function makeService() {
    const prisma: any = {
      clientPaymentSchedule: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      booking: { findUnique: jest.fn() },
      payment: { aggregate: jest.fn() },
    };
    const eventBus = { emit: jest.fn() };
    const paymentTerms = { getActive: jest.fn() };
    const service = new ClientPaymentSchedulesService(prisma, eventBus as any, paymentTerms as any);
    return { service, prisma, eventBus, paymentTerms };
  }

  describe('createForBooking (§5.4.2)', () => {
    it('računa deposit_amount i rokove iz snimljene PaymentTermsConfig, MIN stay_from za balance', async () => {
      const { service, prisma, paymentTerms } = makeService();
      prisma.clientPaymentSchedule.findUnique.mockResolvedValue(null);
      prisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        totalPrice: 100000,
        confirmedAt: new Date('2026-08-01T00:00:00Z'),
        items: [{ stayFrom: new Date('2026-09-01T00:00:00Z') }, { stayFrom: new Date('2026-09-10T00:00:00Z') }],
      });
      paymentTerms.getActive.mockResolvedValue({
        depositPercentage: 30,
        depositDueDaysAfterConfirmation: 3,
        balanceDueDaysBeforeStay: 20,
        escalationDaysAfterDue: 5,
      });
      prisma.clientPaymentSchedule.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'cps-1', ...data }));

      const schedule: any = await service.createForBooking('booking-1');

      expect(schedule.depositAmount).toBe(30000);
      expect(schedule.depositDueDate).toEqual(new Date('2026-08-04T00:00:00Z'));
      // MIN stay_from = 1.9, minus 20 dana = 12.8
      expect(schedule.balanceDueDate).toEqual(new Date('2026-08-12T00:00:00Z'));
    });

    it('je idempotentno — vraća postojeći raspored ako već postoji', async () => {
      const { service, prisma } = makeService();
      prisma.clientPaymentSchedule.findUnique.mockResolvedValue({ id: 'cps-existing' });

      const schedule = await service.createForBooking('booking-1');

      expect(schedule).toEqual({ id: 'cps-existing' });
      expect(prisma.booking.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('onPaymentReceived (§5.4.3)', () => {
    it('postavlja deposit_status = MET čim zbir RECEIVED dostigne deposit_amount', async () => {
      const { service, prisma } = makeService();
      prisma.clientPaymentSchedule.findUnique.mockResolvedValue({
        bookingId: 'booking-1',
        depositAmount: 30000,
        depositStatus: 'PENDING',
        balanceStatus: 'PENDING',
      });
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', paymentStatus: 'PARTIALLY_PAID' });
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 30000 } });

      await service.onPaymentReceived('booking-1');

      expect(prisma.clientPaymentSchedule.update).toHaveBeenCalledWith({
        where: { bookingId: 'booking-1' },
        data: { depositStatus: 'MET' },
      });
    });

    it('balance MET povlači i deposit MET, bez obzira na redosled uplata', async () => {
      const { service, prisma } = makeService();
      prisma.clientPaymentSchedule.findUnique.mockResolvedValue({
        bookingId: 'booking-1',
        depositAmount: 30000,
        depositStatus: 'PENDING',
        balanceStatus: 'PENDING',
      });
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', paymentStatus: 'PAID' });
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 100000 } });

      await service.onPaymentReceived('booking-1');

      expect(prisma.clientPaymentSchedule.update).toHaveBeenCalledWith({
        where: { bookingId: 'booking-1' },
        data: { balanceStatus: 'MET', depositStatus: 'MET' },
      });
    });
  });

  describe('checkOverdueAndEscalate (§5.4.3, §8.2 obrazac)', () => {
    it('generiše WARNING kad je rok probijen ispod praga eskalacije', async () => {
      const { service, prisma, eventBus, paymentTerms } = makeService();
      paymentTerms.getActive.mockResolvedValue({ escalationDaysAfterDue: 10 });
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      prisma.clientPaymentSchedule.findMany.mockResolvedValue([
        {
          id: 'cps-1',
          bookingId: 'booking-1',
          depositStatus: 'PENDING',
          depositDueDate: twoDaysAgo,
          balanceStatus: 'PENDING',
          balanceDueDate: new Date(Date.now() + 100000000),
        },
      ]);

      await service.checkOverdueAndEscalate();

      expect(eventBus.emit).toHaveBeenCalledWith('M10', 'payment_deadline_missed', {
        bookingId: 'booking-1',
        kind: 'deposit',
        severity: 'WARNING',
      });
    });

    it('generiše CRITICAL kad je rok probijen preko praga eskalacije', async () => {
      const { service, prisma, eventBus, paymentTerms } = makeService();
      paymentTerms.getActive.mockResolvedValue({ escalationDaysAfterDue: 5 });
      const twelveDaysAgo = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000);
      prisma.clientPaymentSchedule.findMany.mockResolvedValue([
        {
          id: 'cps-1',
          bookingId: 'booking-1',
          depositStatus: 'OVERDUE',
          depositDueDate: twelveDaysAgo,
          balanceStatus: 'MET',
          balanceDueDate: new Date(),
        },
      ]);

      await service.checkOverdueAndEscalate();

      expect(eventBus.emit).toHaveBeenCalledWith('M10', 'payment_deadline_missed', {
        bookingId: 'booking-1',
        kind: 'deposit',
        severity: 'CRITICAL',
      });
    });
  });
});
