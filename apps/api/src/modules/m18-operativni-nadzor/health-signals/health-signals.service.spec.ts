import { HealthSignalsService } from './health-signals.service';

describe('HealthSignalsService.findAll — straničenje (8.9.2026, dok. 27 nastavak nalaza 2.2)', () => {
  function makeService() {
    const prisma: any = {
      healthSignal: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const dispatch = { dispatch: jest.fn() };
    const eventBus = { emit: jest.fn() };
    const service = new HealthSignalsService(prisma, dispatch as any, eventBus as any);
    return { service, prisma };
  }

  it('vraća { data, total, page, limit } umesto golog niza, poštuje filtere', async () => {
    const { service, prisma } = makeService();
    prisma.healthSignal.findMany.mockResolvedValue([{ id: 's1' }]);
    prisma.healthSignal.count.mockResolvedValue(1);

    const result = await service.findAll({ module: 'M4', severity: 'CRITICAL' });

    expect(prisma.healthSignal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceModule: 'M4', signalType: undefined, severity: 'CRITICAL' },
        skip: 0,
        take: 50,
      }),
    );
    expect(result).toMatchObject({ data: [{ id: 's1' }], total: 1, page: 1, limit: 50 });
  });

  it('drugi limit/stranica se prevode u ispravan skip/take', async () => {
    const { service, prisma } = makeService();
    prisma.healthSignal.count.mockResolvedValue(120);

    await service.findAll({}, { page: 2, limit: 40 });

    expect(prisma.healthSignal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 40 }),
    );
  });
});
