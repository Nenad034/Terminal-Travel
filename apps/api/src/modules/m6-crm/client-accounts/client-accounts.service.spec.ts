import { NotFoundException } from '@nestjs/common';
import { ClientAccountsService } from './client-accounts.service';

// M6 spec §7 dopuna (avgust 2026, priprema za M8) — ownership za Gost kontekst.
describe('ClientAccountsService', () => {
  function makeService() {
    const prisma: any = {
      clientAccount: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn() },
      booking: { findMany: jest.fn().mockResolvedValue([]) },
    };
    // M6 spec §7 dopuna (31.8.2026, M1 §3.9a) — podrazumevano VIEW_ALL=true u testovima
    // pisanim pre ovog mehanizma; testovi specifični za suženje ga eksplicitno menjaju.
    const permissions: any = { hasPermission: jest.fn().mockResolvedValue(true) };
    const service = new ClientAccountsService(prisma, permissions);
    return { service, prisma, permissions };
  }

  describe('findOne — ownership', () => {
    it('interno osoblje (bez actorUserId) vidi bilo koji nalog', async () => {
      const { service, prisma } = makeService();
      prisma.clientAccount.findUnique.mockResolvedValue({ id: 'acc-1' });

      const result = await service.findOne('acc-1');

      expect(result).toEqual({ id: 'acc-1' });
    });

    it('gost vidi sopstveni nalog', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-1' });
      prisma.clientAccount.findUnique.mockResolvedValue({ id: 'acc-1' });

      const result = await service.findOne('acc-1', 'guest-1');

      expect(result).toEqual({ id: 'acc-1' });
    });

    it('gost NE vidi tuđi nalog — 404, ne otkriva postojanje', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-1' });

      await expect(service.findOne('acc-tudj', 'guest-1')).rejects.toThrow(NotFoundException);
      expect(prisma.clientAccount.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('findMany — gost dobija samo sopstveni nalog', () => {
    it('gost dobija niz sa sopstvenim nalogom, filter parametri se ignorišu', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-1' });
      prisma.clientAccount.findUnique.mockResolvedValue({ id: 'acc-1' });

      const result = await service.findMany({ email: 'bilo-koji@primer.rs' }, 'guest-1');

      expect(result).toEqual([{ id: 'acc-1' }]);
      expect(prisma.clientAccount.findMany).not.toHaveBeenCalled();
    });

    it('interno osoblje dobija pun rezultat findMany', async () => {
      const { service, prisma } = makeService();
      prisma.clientAccount.findMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);

      const result = await service.findMany({});

      expect(result).toEqual([{ id: 'a1' }, { id: 'a2' }]);
    });
  });

  describe('VIEW_ALL vidljivost (§7 dopuna, 31.8.2026, M1 §3.9a)', () => {
    it('STAFF sa VIEW_ALL=true dobija sve naloge, bez suženja preko booking vlasništva', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      permissions.hasPermission.mockResolvedValue(true);
      prisma.clientAccount.findMany.mockResolvedValue([{ id: 'a1' }]);

      await service.findMany({}, 'staff-1');

      expect(prisma.clientAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: undefined }) }),
      );
      expect(prisma.booking.findMany).not.toHaveBeenCalled();
    });

    it('STAFF sužen (VIEW_ALL=false) dobija samo naloge sa bar jednom rezervacijom u sopstvenom vlasništvu/zaduženju', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      permissions.hasPermission.mockResolvedValue(false);
      prisma.booking.findMany.mockResolvedValue([{ clientAccountId: 'a1' }, { clientAccountId: 'a2' }]);
      prisma.clientAccount.findMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);

      await service.findMany({}, 'staff-1');

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { OR: [{ ownerId: 'staff-1' }, { assignedToId: 'staff-1' }] } }),
      );
      expect(prisma.clientAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: { in: ['a1', 'a2'] } }) }),
      );
    });

    it('findOne — sužen STAFF ne vidi nalog van sopstvenog opsega, vraća 404', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      permissions.hasPermission.mockResolvedValue(false);
      prisma.booking.findMany.mockResolvedValue([{ clientAccountId: 'a1' }]);

      await expect(service.findOne('a2', 'staff-1')).rejects.toThrow(NotFoundException);
    });

    it('findOne — sužen STAFF vidi nalog KOJI je u opsegu', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      permissions.hasPermission.mockResolvedValue(false);
      prisma.booking.findMany.mockResolvedValue([{ clientAccountId: 'a1' }]);
      prisma.clientAccount.findUnique.mockResolvedValue({ id: 'a1' });

      const result = await service.findOne('a1', 'staff-1');
      expect(result).toEqual({ id: 'a1' });
    });
  });
});
