import { SupplierManifestsService } from './supplier-manifests.service';

describe('SupplierManifestsService.prepareForBooking (M5 spec §8.4 dopuna v1.15)', () => {
  function makeService() {
    const prisma: any = {
      bookingItem: { findMany: jest.fn() },
      supplier: { findUniqueOrThrow: jest.fn() },
      supplierManifest: { create: jest.fn(), count: jest.fn().mockResolvedValue(0), findUnique: jest.fn().mockResolvedValue(null) },
      supplierChangeNotice: { count: jest.fn().mockResolvedValue(0), findUnique: jest.fn().mockResolvedValue(null) },
    };
    const auditLog = { write: jest.fn() };
    const mailbox = { sendViaSharedMailbox: jest.fn() };
    const service = new SupplierManifestsService(prisma, auditLog as any, mailbox as any);
    return { service, prisma };
  }

  it('kad rezervacija ima stavke od dva različita dobavljača, priprema po JEDAN DRAFT nacrt za svakog, ne jedan zajednički', async () => {
    const { service, prisma } = makeService();

    const items = [
      {
        id: 'bi-1',
        stayFrom: new Date('2027-06-01'),
        stayTo: new Date('2027-06-05'),
        rateLine: { contractPeriodId: 'period-hotel' },
        product: { sourceContract: { supplierId: 'supplier-hotel' } },
      },
      {
        id: 'bi-2',
        stayFrom: new Date('2027-06-01'),
        stayTo: new Date('2027-06-01'),
        rateLine: { contractPeriodId: 'period-transfer' },
        product: { sourceContract: { supplierId: 'supplier-transfer' } },
      },
    ];
    prisma.bookingItem.findMany.mockResolvedValue(items);
    prisma.supplier.findUniqueOrThrow.mockImplementation(({ where }: any) =>
      Promise.resolve({ id: where.id, type: 'HOTEL', contactEmail: `${where.id}@example.com` }),
    );
    prisma.supplierManifest.create.mockImplementation(({ data }: any) => Promise.resolve({ id: `manifest-${data.supplierId}`, ...data }));

    const manifests = await service.prepareForBooking('booking-1', 'actor-1');

    expect(manifests).toHaveLength(2);
    const supplierIds = manifests.map((m: any) => m.supplierId).sort();
    expect(supplierIds).toEqual(['supplier-hotel', 'supplier-transfer']);
    // svaka lista sadrži SAMO stavke svog dobavljača, ne obe.
    const hotelManifest: any = manifests.find((m: any) => m.supplierId === 'supplier-hotel');
    expect(hotelManifest?.items).toEqual({ create: [{ bookingItemId: 'bi-1' }] });
    const transferManifest: any = manifests.find((m: any) => m.supplierId === 'supplier-transfer');
    expect(transferManifest?.items).toEqual({ create: [{ bookingItemId: 'bi-2' }] });
  });

  it('ne uključuje stavke koje su već na ne-SUPERSEDED listi (isti filter kao periodično generisanje)', async () => {
    const { service, prisma } = makeService();
    prisma.bookingItem.findMany.mockResolvedValue([]);

    const manifests = await service.prepareForBooking('booking-empty', 'actor-1');

    expect(manifests).toEqual([]);
    expect(prisma.bookingItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bookingId: 'booking-empty',
          sourceType: 'CONTRACTED',
          itemStatus: 'CONFIRMED',
          manifestEntries: { none: { supplierManifest: { status: { not: 'SUPERSEDED' } } } },
        }),
      }),
    );
  });
});
