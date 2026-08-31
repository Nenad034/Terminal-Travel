import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClientContractsService } from './client-contracts.service';

describe('ClientContractsService (M20 spec §3)', () => {
  function makeService() {
    const prisma: any = {
      clientContract: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      booking: { findUnique: jest.fn() },
      travelGuarantee: { findFirst: jest.fn() },
      clientPaymentSchedule: { findUnique: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const auditLog = { write: jest.fn() };
    const agencyConfig = {
      get: jest.fn().mockReturnValue({
        agencyName: 'Terminal Travel',
        agencyAddress: 'Adresa',
        agencyLicenseNumber: 'OTP-1',
        emergencyContact: '+381',
        priceChangeComplaintDeadlineDays: 8,
      }),
    };
    const gateway = { generate: jest.fn() };
    const permissions = { hasPermission: jest.fn().mockResolvedValue(true) };
    const service = new ClientContractsService(prisma, auditLog as any, agencyConfig as any, gateway as any, permissions as any);
    return { service, prisma, auditLog, agencyConfig, gateway, permissions };
  }

  const bookingFixture = {
    id: 'booking-1',
    tipNastupanja: 'ORGANIZATOR',
    totalPrice: 100000,
    currency: 'EUR',
    contractTermsAcceptedAt: null,
    items: [
      {
        id: 'item-1',
        itemStatus: 'CONFIRMED',
        stayFrom: new Date('2027-06-10'),
        stayTo: new Date('2027-06-17'),
        cancellationPolicySnapshot: null,
        product: { type: 'ACCOMMODATION', attributes: { stars: 4 }, translations: [{ languageCode: 'sr', name: 'Hotel Test' }] },
        rateLine: { boardType: 'HALF_BOARD', contractPeriod: { cancellationRules: [] } },
      },
    ],
  };

  describe('generateForBooking (§3.1)', () => {
    it('vraća postojeći aktivan ugovor umesto duplog generisanja (idempotentno)', async () => {
      const { service, prisma } = makeService();
      prisma.clientContract.findFirst.mockResolvedValue({ id: 'cc-1' });

      const result = await service.generateForBooking('booking-1');

      expect(result).toEqual({ id: 'cc-1' });
      expect(prisma.booking.findUnique).not.toHaveBeenCalled();
    });

    it('generiše GENERATED ugovor za INTERNAL_PANEL rezervaciju bez prethodnog clickwrap pristanka', async () => {
      const { service, prisma, gateway, auditLog } = makeService();
      prisma.clientContract.findFirst.mockResolvedValue(null);
      prisma.booking.findUnique.mockResolvedValue(bookingFixture);
      prisma.travelGuarantee.findFirst.mockResolvedValue({ provider: 'YUTA', policyNumber: 'P-1' });
      prisma.clientPaymentSchedule.findUnique.mockResolvedValue(null);
      gateway.generate.mockResolvedValue({ documentUrl: 'mock://doc.pdf' });
      prisma.clientContract.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'cc-1', ...data }));

      const result = await service.generateForBooking('booking-1');

      expect(result!.status).toBe('GENERATED');
      expect(result!.contractType).toBe('ORGANIZOVANO_PUTOVANJE');
      expect(result!.acceptedAt).toBeNull();
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ actorType: 'SYSTEM', action: 'client_contract.generated' }));
    });

    it('automatski prevodi u ACCEPTED kad je clickwrap pristanak već dat pre potvrde (§3.2)', async () => {
      const { service, prisma, gateway } = makeService();
      const acceptedAt = new Date('2027-01-01T10:00:00Z');
      prisma.clientContract.findFirst.mockResolvedValue(null);
      prisma.booking.findUnique.mockResolvedValue({ ...bookingFixture, contractTermsAcceptedAt: acceptedAt });
      prisma.travelGuarantee.findFirst.mockResolvedValue(null);
      prisma.clientPaymentSchedule.findUnique.mockResolvedValue(null);
      gateway.generate.mockResolvedValue({ documentUrl: 'mock://doc.pdf' });
      prisma.clientContract.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'cc-1', ...data }));

      const result = await service.generateForBooking('booking-1');

      expect(result!.status).toBe('ACCEPTED');
      expect(result!.acceptedMethod).toBe('ELECTRONIC_CLICKWRAP');
      expect(result!.acceptedAt).toEqual(acceptedAt);
    });

    it('preskače generisanje (vraća null) za samo-INSURANCE rezervaciju (§2.2/§8)', async () => {
      const { service, prisma, gateway } = makeService();
      prisma.clientContract.findFirst.mockResolvedValue(null);
      prisma.booking.findUnique.mockResolvedValue({
        ...bookingFixture,
        items: [{ ...bookingFixture.items[0], product: { type: 'INSURANCE', attributes: {}, translations: [] } }],
      });

      const result = await service.generateForBooking('booking-1');

      expect(result).toBeNull();
      expect(gateway.generate).not.toHaveBeenCalled();
      expect(prisma.clientContract.create).not.toHaveBeenCalled();
    });
  });

  describe('voidAndRegenerateForModification (§3.4)', () => {
    it('ne radi ništa kad nema aktivnog ugovora', async () => {
      const { service, prisma } = makeService();
      prisma.clientContract.findFirst.mockResolvedValue(null);

      const result = await service.voidAndRegenerateForModification('booking-1');

      expect(result).toBeNull();
      expect(prisma.clientContract.update).not.toHaveBeenCalled();
    });

    it('poništava (sistemski, voided_by=null) stari i generiše novu verziju koja UVEK ostaje GENERATED, čak i ako je stara bila ACCEPTED', async () => {
      const { service, prisma, gateway, auditLog } = makeService();
      const oldContract = { id: 'cc-old', status: 'ACCEPTED' };
      prisma.clientContract.findFirst.mockResolvedValue(oldContract);
      prisma.clientContract.update.mockImplementation(({ data }: any) => Promise.resolve({ ...oldContract, ...data }));
      // ugovor je i dalje ACCEPTED-poreklom (contractTermsAcceptedAt postavljen), ali revizija ipak mora GENERATED
      prisma.booking.findUnique.mockResolvedValue({ ...bookingFixture, contractTermsAcceptedAt: new Date() });
      prisma.travelGuarantee.findFirst.mockResolvedValue(null);
      prisma.clientPaymentSchedule.findUnique.mockResolvedValue(null);
      gateway.generate.mockResolvedValue({ documentUrl: 'mock://doc-v2.pdf' });
      prisma.clientContract.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'cc-new', ...data }));

      const result = await service.voidAndRegenerateForModification('booking-1');

      expect(prisma.clientContract.update).toHaveBeenCalledWith({ where: { id: 'cc-old' }, data: { status: 'VOIDED', voidedBy: null } });
      expect(result!.status).toBe('GENERATED'); // nikad automatski ACCEPTED posle revizije
      expect(result!.supersedesContractId).toBe('cc-old');
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'client_contract.voided_for_modification' }));
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'client_contract.regenerated' }));
    });
  });

  describe('accept (§3.2 ručno evidentiranje)', () => {
    it('odbija prihvatanje van statusa GENERATED', async () => {
      const { service, prisma } = makeService();
      prisma.clientContract.findUnique.mockResolvedValue({ id: 'cc-1', status: 'DRAFT' });

      await expect(service.accept('cc-1', { userId: 'actor-1' })).rejects.toThrow(BadRequestException);
    });

    it('postavlja ACCEPTED/WET_SIGNATURE_SCAN i upisuje HUMAN audit log', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.clientContract.findUnique.mockResolvedValue({ id: 'cc-1', status: 'GENERATED' });
      prisma.clientContract.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 'cc-1', ...data }));

      const result = await service.accept('cc-1', { userId: 'actor-1' });

      expect(result.status).toBe('ACCEPTED');
      expect(result.acceptedMethod).toBe('WET_SIGNATURE_SCAN');
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ actorType: 'HUMAN', actorId: 'actor-1', action: 'client_contract.accepted' }));
    });
  });

  describe('void (§5)', () => {
    it('odbija void nad već VOIDED ugovorom', async () => {
      const { service, prisma } = makeService();
      prisma.clientContract.findUnique.mockResolvedValue({ id: 'cc-1', status: 'VOIDED' });

      await expect(service.void('cc-1', { userId: 'actor-1' })).rejects.toThrow(BadRequestException);
    });

    it('postavlja VOIDED sa voided_by = actor i upisuje HUMAN audit log', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.clientContract.findUnique.mockResolvedValue({ id: 'cc-1', status: 'GENERATED' });
      prisma.clientContract.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 'cc-1', ...data }));

      const result = await service.void('cc-1', { userId: 'actor-1' });

      expect(result.status).toBe('VOIDED');
      expect(result.voidedBy).toBe('actor-1');
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ actorType: 'HUMAN', actorId: 'actor-1', action: 'client_contract.voided' }));
    });
  });

  describe('hasGeneratedContract (M5 §6 vaučer ograda)', () => {
    it('vraća true kad postoji GENERATED ili ACCEPTED ugovor', async () => {
      const { service, prisma } = makeService();
      prisma.clientContract.findFirst.mockResolvedValue({ id: 'cc-1', status: 'GENERATED' });

      await expect(service.hasGeneratedContract('booking-1')).resolves.toBe(true);
      expect(prisma.clientContract.findFirst).toHaveBeenCalledWith({
        where: { bookingId: 'booking-1', status: { in: ['GENERATED', 'ACCEPTED'] } },
      });
    });

    it('vraća false kad nijedan ugovor ne postoji u tim statusima', async () => {
      const { service, prisma } = makeService();
      prisma.clientContract.findFirst.mockResolvedValue(null);

      await expect(service.hasGeneratedContract('booking-1')).resolves.toBe(false);
    });
  });

  describe('findOne/findMany — ownership (§6 dopuna, priprema za M8)', () => {
    it('gost NE vidi ugovor tuđe rezervacije — 404', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-own' });
      prisma.clientContract.findUnique.mockResolvedValue({ id: 'cc-1', bookingId: 'booking-1' });
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', clientAccountId: 'acc-tudj' });

      await expect(service.findOne('cc-1', 'guest-1')).rejects.toThrow(NotFoundException);
    });

    it('gost vidi ugovor sopstvene rezervacije', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-own' });
      prisma.clientContract.findUnique.mockResolvedValue({ id: 'cc-1', bookingId: 'booking-1' });
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', clientAccountId: 'acc-own' });

      const result = await service.findOne('cc-1', 'guest-1');

      expect(result.id).toBe('cc-1');
    });

    it('findMany za gosta filtrira po sopstvenom nalogu', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-own' });
      prisma.clientContract.findMany.mockResolvedValue([]);

      await service.findMany({}, 'guest-1');

      expect(prisma.clientContract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ booking: { clientAccountId: 'acc-own' } }) }),
      );
    });

    it('interno osoblje (bez actorUserId) vidi bez ownership filtera', async () => {
      const { service, prisma } = makeService();
      prisma.clientContract.findMany.mockResolvedValue([]);

      await service.findMany({});

      expect(prisma.clientContract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ booking: undefined }) }),
      );
    });
  });

  describe('VIEW_ALL vidljivost za STAFF (§6 dopuna, 31.8.2026, M1 §3.9a)', () => {
    it('STAFF sa VIEW_ALL=true ne dobija booking filter', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      permissions.hasPermission.mockResolvedValue(true);
      prisma.clientContract.findMany.mockResolvedValue([]);

      await service.findMany({}, 'staff-1');

      expect(prisma.clientContract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ booking: undefined }) }),
      );
    });

    it('STAFF sužen (VIEW_ALL=false) filtrira na booking vlasništvo/zaduženje', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      permissions.hasPermission.mockResolvedValue(false);
      prisma.clientContract.findMany.mockResolvedValue([]);

      await service.findMany({}, 'staff-1');

      expect(prisma.clientContract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ booking: { OR: [{ ownerId: 'staff-1' }, { assignedToId: 'staff-1' }] } }),
        }),
      );
    });

    it('findOne — sužen STAFF ne vidi ugovor van sopstvenog opsega, vraća 404', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      permissions.hasPermission.mockResolvedValue(false);
      prisma.clientContract.findUnique.mockResolvedValue({ id: 'c1', bookingId: 'b1' });
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', ownerId: 'neko-drugi', assignedToId: 'neko-drugi' });

      await expect(service.findOne('c1', 'staff-1')).rejects.toThrow(NotFoundException);
    });

    it('findOne — sužen STAFF vidi ugovor gde je zadužen', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      permissions.hasPermission.mockResolvedValue(false);
      prisma.clientContract.findUnique.mockResolvedValue({ id: 'c1', bookingId: 'b1' });
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', ownerId: 'neko-drugi', assignedToId: 'staff-1' });

      const result = await service.findOne('c1', 'staff-1');
      expect(result).toEqual({ id: 'c1', bookingId: 'b1' });
    });
  });
});
