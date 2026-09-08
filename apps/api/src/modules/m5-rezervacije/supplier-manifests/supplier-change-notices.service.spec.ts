import { SupplierChangeNoticesService } from './supplier-change-notices.service';

describe('SupplierChangeNoticesService.findAll — straničenje (8.9.2026, dok. 27 nastavak nalaza 2.2)', () => {
  function makeService() {
    const prisma: any = {
      supplierChangeNotice: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const auditLog = { write: jest.fn() };
    const mailbox = { sendViaSharedMailbox: jest.fn() };
    const service = new SupplierChangeNoticesService(prisma, auditLog as any, mailbox as any);
    return { service, prisma };
  }

  it('vraća { data, total, page, limit } umesto golog niza, poštuje bookingItemId filter', async () => {
    const { service, prisma } = makeService();
    prisma.supplierChangeNotice.findMany.mockResolvedValue([{ id: 'n1' }]);
    prisma.supplierChangeNotice.count.mockResolvedValue(1);

    const result = await service.findAll('bi-1');

    expect(prisma.supplierChangeNotice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { bookingItemId: 'bi-1' }, skip: 0, take: 50 }),
    );
    expect(result).toMatchObject({ data: [{ id: 'n1' }], total: 1, page: 1, limit: 50 });
  });
});
