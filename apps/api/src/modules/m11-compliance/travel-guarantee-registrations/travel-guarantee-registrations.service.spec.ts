import { BadRequestException } from '@nestjs/common';
import { TravelGuaranteeRegistrationsService } from './travel-guarantee-registrations.service';

describe('TravelGuaranteeRegistrationsService (M11 spec §2.3)', () => {
  function makeService() {
    const prisma: any = {
      travelGuaranteeRegistration: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      booking: { findUnique: jest.fn() },
      travelGuarantee: { findFirst: jest.fn(), findUnique: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const gateway = { register: jest.fn(), release: jest.fn() };
    const service = new TravelGuaranteeRegistrationsService(prisma, auditLog as any, gateway as any);
    return { service, prisma, auditLog, gateway };
  }

  describe('createForBooking', () => {
    it('vraća postojeći zapis umesto duple registracije (idempotentno)', async () => {
      const { service, prisma } = makeService();
      prisma.travelGuaranteeRegistration.findUnique.mockResolvedValue({ id: 'reg-1' });

      const result = await service.createForBooking('booking-1');

      expect(result).toEqual({ id: 'reg-1' });
      expect(prisma.booking.findUnique).not.toHaveBeenCalled();
    });

    it('kreira PENDING pa REGISTERED zapis kad CIS registracija uspe', async () => {
      const { service, prisma, gateway, auditLog } = makeService();
      prisma.travelGuaranteeRegistration.findUnique.mockResolvedValue(null);
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', bookingNumber: 'TT-1' });
      prisma.travelGuarantee.findFirst.mockResolvedValue({ id: 'tg-1', policyNumber: 'P-1' });
      prisma.travelGuaranteeRegistration.create.mockResolvedValue({
        id: 'reg-1',
        bookingId: 'booking-1',
        travelGuaranteeId: 'tg-1',
        status: 'PENDING',
      });
      gateway.register.mockResolvedValue({ cisRegistrationNumber: 'CIS-1' });
      prisma.travelGuaranteeRegistration.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'reg-1', bookingId: 'booking-1', travelGuaranteeId: 'tg-1', ...data }),
      );

      const result = await service.createForBooking('booking-1');

      expect(gateway.register).toHaveBeenCalledWith({
        bookingId: 'booking-1',
        bookingNumber: 'TT-1',
        travelGuaranteeId: 'tg-1',
        policyNumber: 'P-1',
      });
      expect(result.status).toBe('REGISTERED');
      expect(result.cisRegistrationNumber).toBe('CIS-1');
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ actorType: 'SYSTEM', action: 'travel_guarantee_registration.registered' }));
    });

    it('prelazi u FAILED kad CIS registracija baci grešku', async () => {
      const { service, prisma, gateway } = makeService();
      prisma.travelGuaranteeRegistration.findUnique.mockResolvedValue(null);
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', bookingNumber: 'TT-1' });
      prisma.travelGuarantee.findFirst.mockResolvedValue({ id: 'tg-1', policyNumber: 'P-1' });
      prisma.travelGuaranteeRegistration.create.mockResolvedValue({ id: 'reg-1', bookingId: 'booking-1', travelGuaranteeId: 'tg-1', status: 'PENDING' });
      gateway.register.mockRejectedValue(new Error('CIS nedostupan'));
      prisma.travelGuaranteeRegistration.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 'reg-1', ...data }));

      const result = await service.createForBooking('booking-1');

      expect(result.status).toBe('FAILED');
      expect(result.failureReason).toBe('CIS nedostupan');
    });

    it('kreira FAILED zapis bez travel_guarantee_id kad nijedna garancija ne postoji (bootstrap)', async () => {
      const { service, prisma, gateway } = makeService();
      prisma.travelGuaranteeRegistration.findUnique.mockResolvedValue(null);
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', bookingNumber: 'TT-1' });
      prisma.travelGuarantee.findFirst.mockResolvedValue(null);
      prisma.travelGuaranteeRegistration.create.mockResolvedValue({ id: 'reg-1', bookingId: 'booking-1', travelGuaranteeId: null, status: 'FAILED' });

      const result = await service.createForBooking('booking-1');

      expect(result.status).toBe('FAILED');
      expect(gateway.register).not.toHaveBeenCalled();
    });
  });

  describe('releaseForBooking', () => {
    it('prevodi REGISTERED zapis u RELEASE_PENDING pa RELEASED kad CIS skidanje uspe', async () => {
      const { service, prisma, gateway } = makeService();
      prisma.travelGuaranteeRegistration.findUnique.mockResolvedValue({
        id: 'reg-1',
        status: 'REGISTERED',
        cisRegistrationNumber: 'CIS-1',
      });
      prisma.travelGuaranteeRegistration.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'reg-1', cisRegistrationNumber: 'CIS-1', ...data }),
      );
      gateway.release.mockResolvedValue(undefined);

      const result = await service.releaseForBooking('booking-1');

      expect(gateway.release).toHaveBeenCalledWith({ cisRegistrationNumber: 'CIS-1' });
      expect(result!.status).toBe('RELEASED');
    });

    it('ne diraj zapis koji je već RELEASED', async () => {
      const { service, prisma, gateway } = makeService();
      prisma.travelGuaranteeRegistration.findUnique.mockResolvedValue({ id: 'reg-1', status: 'RELEASED' });

      const result = await service.releaseForBooking('booking-1');

      expect(result!.status).toBe('RELEASED');
      expect(gateway.release).not.toHaveBeenCalled();
    });

    it('vraća null kad zapis ne postoji (rezervacija nije bila ORGANIZATOR/nije nikad registrovana)', async () => {
      const { service, prisma } = makeService();
      prisma.travelGuaranteeRegistration.findUnique.mockResolvedValue(null);

      const result = await service.releaseForBooking('booking-1');

      expect(result).toBeNull();
    });
  });

  describe('retry', () => {
    it('odbija retry nad zapisom koji nije FAILED/PENDING/RELEASE_PENDING', async () => {
      const { service, prisma } = makeService();
      prisma.travelGuaranteeRegistration.findUnique.mockResolvedValue({ id: 'reg-1', status: 'REGISTERED' });

      await expect(service.retry('reg-1', { userId: 'actor-1' })).rejects.toThrow(BadRequestException);
    });

    it('ponavlja registraciju za FAILED zapis i upisuje HUMAN audit log', async () => {
      const { service, prisma, gateway, auditLog } = makeService();
      prisma.travelGuaranteeRegistration.findUnique.mockResolvedValue({
        id: 'reg-1',
        bookingId: 'booking-1',
        travelGuaranteeId: 'tg-1',
        status: 'FAILED',
      });
      prisma.travelGuarantee.findUnique.mockResolvedValue({ id: 'tg-1', policyNumber: 'P-1' });
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', bookingNumber: 'TT-1' });
      gateway.register.mockResolvedValue({ cisRegistrationNumber: 'CIS-2' });
      prisma.travelGuaranteeRegistration.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 'reg-1', ...data }));

      const result = await service.retry('reg-1', { userId: 'actor-1' });

      expect(result.status).toBe('REGISTERED');
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ actorType: 'HUMAN', actorId: 'actor-1', action: 'travel_guarantee_registration.retry' }));
    });
  });
});
