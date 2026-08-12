import { NotFoundException } from '@nestjs/common';
import { ClientAccountsService } from './client-accounts.service';

// M6 spec §7 dopuna (avgust 2026, priprema za M8) — ownership za Gost kontekst.
describe('ClientAccountsService', () => {
  function makeService() {
    const prisma: any = {
      clientAccount: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn() },
    };
    const service = new ClientAccountsService(prisma);
    return { service, prisma };
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
});
