import { WeeklyReviewsService } from './weekly-reviews.service';

describe('WeeklyReviewsService.findAll — straničenje (8.9.2026, dok. 27 nastavak nalaza 2.2)', () => {
  function makeService() {
    const prisma: any = {
      weeklyHealthReview: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const healthSignals = { findSince: jest.fn() };
    const dispatch = { dispatchText: jest.fn() };
    const service = new WeeklyReviewsService(prisma, healthSignals as any, dispatch as any);
    return { service, prisma };
  }

  it('vraća { data, total, page, limit } umesto golog niza — panel uzima [0] posle ovoga za "najskoriji"', async () => {
    const { service, prisma } = makeService();
    prisma.weeklyHealthReview.findMany.mockResolvedValue([{ id: 'r1' }]);
    prisma.weeklyHealthReview.count.mockResolvedValue(1);

    const result = await service.findAll({ limit: 1 });

    expect(prisma.weeklyHealthReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { periodStart: 'desc' }, skip: 0, take: 1 }),
    );
    expect(result).toMatchObject({ data: [{ id: 'r1' }], total: 1, page: 1, limit: 1 });
  });
});
