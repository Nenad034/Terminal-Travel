import { ContentService } from './content.service';

describe('ContentService.findAll — straničenje (8.9.2026, dok. 27 nastavak nalaza 2.2)', () => {
  function makeService() {
    const prisma: any = {
      contentPiece: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const auditLog = { write: jest.fn() };
    const distribution = {};
    const service = new ContentService(prisma, auditLog as any, distribution as any);
    return { service, prisma };
  }

  it('vraća { data, total, page, limit } umesto golog niza, poštuje filtere', async () => {
    const { service, prisma } = makeService();
    prisma.contentPiece.findMany.mockResolvedValue([{ id: 'cp1' }]);
    prisma.contentPiece.count.mockResolvedValue(1);

    const result = await service.findAll({ type: 'BLOG_POST' as any, status: 'DRAFT' as any });

    expect(prisma.contentPiece.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'BLOG_POST', status: 'DRAFT' }),
        skip: 0,
        take: 50,
      }),
    );
    expect(result).toMatchObject({ data: [{ id: 'cp1' }], total: 1, page: 1, limit: 50 });
  });
});
