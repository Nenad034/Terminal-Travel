import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GuestProfilesService } from './guest-profiles.service';

// M6 spec §7 dopuna (avgust 2026, priprema za M8) — ownership za Gost kontekst.
describe('GuestProfilesService', () => {
  function makeService() {
    const prisma: any = {
      guestProfile: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn() },
    };
    const service = new GuestProfilesService(prisma);
    return { service, prisma };
  }

  describe('findOne — ownership', () => {
    it('gost NE vidi profil povezan na tuđi nalog — 404', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-1' });
      prisma.guestProfile.findUnique.mockResolvedValue({ id: 'gp-1', linkedClientAccountId: 'acc-tudj' });

      await expect(service.findOne('gp-1', 'guest-1')).rejects.toThrow(NotFoundException);
    });

    it('gost vidi sopstveni profil', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-1' });
      prisma.guestProfile.findUnique.mockResolvedValue({ id: 'gp-1', linkedClientAccountId: 'acc-1' });

      const result = await service.findOne('gp-1', 'guest-1');

      expect(result.id).toBe('gp-1');
    });
  });

  describe('create — gost sme da kreira samo za sebe', () => {
    it('baca ForbiddenException ako gost pokuša da poveže profil na tuđi nalog', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-1' });

      await expect(
        service.create(
          {
            fullName: 'Gost Gostić',
            documentType: 'PASSPORT',
            documentNumber: 'AB123456',
            nationality: 'RS',
            dateOfBirth: '1990-01-01',
            linkedClientAccountId: 'acc-tudj',
          } as any,
          'guest-1',
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.guestProfile.create).not.toHaveBeenCalled();
    });

    it('gost bez eksplicitnog linkedClientAccountId dobija automatski sopstveni', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-1' });
      prisma.guestProfile.create.mockResolvedValue({ id: 'gp-1' });

      await service.create(
        {
          fullName: 'Gost Gostić',
          documentType: 'PASSPORT',
          documentNumber: 'AB123456',
          nationality: 'RS',
          dateOfBirth: '1990-01-01',
        } as any,
        'guest-1',
      );

      expect(prisma.guestProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ linkedClientAccountId: 'acc-1' }) }),
      );
    });
  });

  // Nalaz (30.8.2026, Faza 8 IDOR pregled — docs/analize/34-FAZA8-BEZBEDNOSNI-PREGLED.md):
  // `update()` je do sad primenjivao ISTU proveru vlasništva kao `findOne()` PRE izmene, ali
  // nije sprečavao gosta da u istom pozivu prebaci sopstveni (već-vlastiti) profil na TUĐ
  // nalog preko `linkedClientAccountId` — `create()` je tu proveru već imao, `update()` ne.
  describe('update — gost ne sme da prebaci sopstveni profil na tuđi nalog', () => {
    it('baca ForbiddenException ako gost pokuša da promeni linkedClientAccountId na tuđi nalog', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-1' });
      prisma.guestProfile.findUnique.mockResolvedValue({ id: 'gp-1', linkedClientAccountId: 'acc-1' });

      await expect(service.update('gp-1', { linkedClientAccountId: 'acc-tudj' } as any, 'guest-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.guestProfile.update).not.toHaveBeenCalled();
    });

    it('dozvoljava izmenu kad gost ne dira linkedClientAccountId (ili ga postavlja na sopstveni)', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-1' });
      prisma.guestProfile.findUnique.mockResolvedValue({ id: 'gp-1', linkedClientAccountId: 'acc-1' });
      prisma.guestProfile.update.mockResolvedValue({ id: 'gp-1' });

      await service.update('gp-1', { fullName: 'Novo Ime' } as any, 'guest-1');

      expect(prisma.guestProfile.update).toHaveBeenCalled();
    });
  });
});
