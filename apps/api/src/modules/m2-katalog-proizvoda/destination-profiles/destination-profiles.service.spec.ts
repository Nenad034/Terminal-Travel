import { ConflictException } from '@nestjs/common';
import { DestinationProfilesService } from './destination-profiles.service';

describe('DestinationProfilesService (M2 spec §2.1c)', () => {
  function makeService() {
    const prisma = {
      destinationProfile: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const auditLog = { write: jest.fn() };
    const service = new DestinationProfilesService(prisma as any, auditLog as any);
    return { service, prisma, auditLog };
  }

  describe('create', () => {
    it('kreira profil i upisuje audit log kad par (country, city) još ne postoji', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.destinationProfile.findUnique.mockResolvedValue(null);
      const created = { id: 'dp1', destinationCountry: 'Austrija', destinationCity: 'Bad Klajnkirhajm', destinationType: 'MOUNTAIN', activities: [] };
      prisma.destinationProfile.create.mockResolvedValue(created);

      const result = await service.create(
        { destinationCountry: 'Austrija', destinationCity: 'Bad Klajnkirhajm', destinationType: 'MOUNTAIN' as any },
        'actor-1',
      );

      expect(prisma.destinationProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            destinationCountry: 'Austrija',
            destinationCity: 'Bad Klajnkirhajm',
            destinationType: 'MOUNTAIN',
            activities: [],
            createdBy: 'actor-1',
          }),
        }),
      );
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'destination_profile.created', module: 'M2' }));
      expect(result).toBe(created);
    });

    it('odbija drugi profil za isti par (country, city) — §2.1c najviše jedan profil po destinaciji', async () => {
      const { service, prisma } = makeService();
      prisma.destinationProfile.findUnique.mockResolvedValue({ id: 'dp1' });

      await expect(
        service.create({ destinationCountry: 'Austrija', destinationCity: 'Bad Klajnkirhajm', destinationType: 'MOUNTAIN' as any }, 'actor-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.destinationProfile.create).not.toHaveBeenCalled();
    });

    it('prazno/izostavljeno activities upisuje kao [] — "nepoznato", ne "nijedna"', async () => {
      const { service, prisma } = makeService();
      prisma.destinationProfile.findUnique.mockResolvedValue(null);
      prisma.destinationProfile.create.mockResolvedValue({ id: 'dp1' });

      await service.create({ destinationCountry: 'Srbija', destinationCity: 'Zlatibor', destinationType: 'MOUNTAIN' as any }, 'actor-1');

      expect(prisma.destinationProfile.create.mock.calls[0][0].data.activities).toEqual([]);
    });
  });

  describe('update', () => {
    it('menja destinationType/activities i upisuje audit log sa before/after', async () => {
      const { service, prisma, auditLog } = makeService();
      const before = { id: 'dp1', destinationType: 'MOUNTAIN', activities: [] };
      const after = { id: 'dp1', destinationType: 'MOUNTAIN', activities: ['CYCLING', 'HIKING'] };
      prisma.destinationProfile.findUniqueOrThrow.mockResolvedValue(before);
      prisma.destinationProfile.update.mockResolvedValue(after);

      const result = await service.update('dp1', { activities: ['CYCLING', 'HIKING'] as any }, 'actor-1');

      expect(prisma.destinationProfile.update).toHaveBeenCalledWith({
        where: { id: 'dp1' },
        data: { destinationType: undefined, activities: ['CYCLING', 'HIKING'] },
      });
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'destination_profile.updated', beforeState: before, afterState: after }),
      );
      expect(result).toBe(after);
    });
  });
});
