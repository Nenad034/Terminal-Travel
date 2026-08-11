import { BadRequestException } from '@nestjs/common';
import { ProviderConfigsService } from './provider-configs.service';

describe('ProviderConfigsService', () => {
  function makeService() {
    const prisma = { providerConfig: { findMany: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn() } };
    const auditLog = { write: jest.fn() };
    const registry = { invalidate: jest.fn() };
    const service = new ProviderConfigsService(prisma as any, auditLog as any, registry as any);
    return { service, prisma, auditLog, registry };
  }

  describe('kredencijali se nikad ne vraćaju u odgovoru (M4 spec §9)', () => {
    it('findAll uklanja authConfigEncrypted iz svakog zapisa', async () => {
      const { service, prisma } = makeService();
      prisma.providerConfig.findMany.mockResolvedValue([
        { providerCode: 'travelgate', authConfigEncrypted: 'tajna-vrednost' },
      ]);

      const result = await service.findAll();
      expect(result[0]).not.toHaveProperty('authConfigEncrypted');
    });

    it('create uklanja authConfigEncrypted iz odgovora, ali ga enkriptovanog upisuje u bazu', async () => {
      const { service, prisma } = makeService();
      prisma.providerConfig.create.mockResolvedValue({
        id: 'p1',
        providerCode: 'travelgate',
        authConfigEncrypted: 'enkriptovano',
      });

      const result = await service.create(
        {
          providerCode: 'travelgate',
          displayName: 'Travelgate',
          category: 'HOTEL' as any,
          authConfig: { apiKey: 'tajni-kljuc' },
          authStrategy: 'API_KEY' as any,
          timeoutSearchMs: 8000,
          timeoutBookingMs: 15000,
        },
        'actor-1',
      );

      expect(result).not.toHaveProperty('authConfigEncrypted');
      const createCall = prisma.providerConfig.create.mock.calls[0][0];
      expect(createCall.data.authConfigEncrypted).not.toContain('tajni-kljuc');
      expect(createCall.data.status).toBe('INACTIVE');
    });
  });

  describe('update — default_tip_nastupanja gejt pre ACTIVE (M4 spec §3.1/§8)', () => {
    it('odbija prelaz u ACTIVE bez default_tip_nastupanja', async () => {
      const { service, prisma } = makeService();
      prisma.providerConfig.findUniqueOrThrow.mockResolvedValue({
        providerCode: 'travelgate',
        status: 'INACTIVE',
        defaultTipNastupanja: null,
        authConfigEncrypted: 'x',
      });

      await expect(service.update('travelgate', { status: 'ACTIVE' as any }, 'actor-1')).rejects.toThrow(BadRequestException);
      expect(prisma.providerConfig.update).not.toHaveBeenCalled();
    });

    it('dozvoljava prelaz u ACTIVE kad je default_tip_nastupanja već postavljen', async () => {
      const { service, prisma } = makeService();
      prisma.providerConfig.findUniqueOrThrow.mockResolvedValue({
        providerCode: 'travelgate',
        status: 'INACTIVE',
        defaultTipNastupanja: 'ORGANIZATOR',
        authConfigEncrypted: 'x',
      });
      prisma.providerConfig.update.mockResolvedValue({ providerCode: 'travelgate', status: 'ACTIVE', authConfigEncrypted: 'x' });

      const result = await service.update('travelgate', { status: 'ACTIVE' as any }, 'actor-1');
      expect(result.status).toBe('ACTIVE');
    });

    it('invalidira keširanu adapter instancu u registru posle izmene', async () => {
      const { service, prisma, registry } = makeService();
      prisma.providerConfig.findUniqueOrThrow.mockResolvedValue({
        providerCode: 'travelgate',
        status: 'ACTIVE',
        defaultTipNastupanja: 'ORGANIZATOR',
        authConfigEncrypted: 'x',
      });
      prisma.providerConfig.update.mockResolvedValue({ providerCode: 'travelgate', authConfigEncrypted: 'x' });

      await service.update('travelgate', { useMock: true }, 'actor-1');

      expect(registry.invalidate).toHaveBeenCalledWith('travelgate');
    });
  });
});
