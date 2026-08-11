import { ProviderCallLogsService } from './provider-call-logs.service';

describe('ProviderCallLogsService (M4 spec §7 — filtrirano po provajderu/operaciji/datumu)', () => {
  it('prosleđuje filtere Prisma upitu i ograničava na 200 zapisa', async () => {
    const prisma = { providerCallLog: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new ProviderCallLogsService(prisma as any);

    await service.find({ providerCode: 'travelgate', operation: 'SEARCH' as any });

    expect(prisma.providerCallLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ providerCode: 'travelgate', operation: 'SEARCH' }),
        orderBy: { timestamp: 'desc' },
        take: 200,
      }),
    );
  });
});
