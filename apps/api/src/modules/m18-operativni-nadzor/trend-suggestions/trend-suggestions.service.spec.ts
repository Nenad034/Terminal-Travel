import { TrendSuggestionsService } from './trend-suggestions.service';

describe('TrendSuggestionsService.findAll — straničenje (8.9.2026, dok. 27 nastavak nalaza 2.2)', () => {
  function makeService() {
    const prisma: any = {
      trendSuggestion: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const service = new TrendSuggestionsService(prisma);
    return { service, prisma };
  }

  it('vraća { data, total, page, limit } umesto golog niza', async () => {
    const { service, prisma } = makeService();
    prisma.trendSuggestion.findMany.mockResolvedValue([{ id: 't1' }]);
    prisma.trendSuggestion.count.mockResolvedValue(1);

    const result = await service.findAll();

    expect(prisma.trendSuggestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' }, skip: 0, take: 50 }),
    );
    expect(result).toMatchObject({ data: [{ id: 't1' }], total: 1, page: 1, limit: 50 });
  });
});
