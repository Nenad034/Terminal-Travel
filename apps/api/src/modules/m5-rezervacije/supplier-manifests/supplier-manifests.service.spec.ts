import { BadRequestException } from '@nestjs/common';
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

describe('SupplierManifestsService.prepareBatch (M5 spec §8.4 dopuna v1.16)', () => {
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

  it('odbija poziv kad NIJEDAN od bookingIds/opsega datuma nije prosleđen', async () => {
    const { service } = makeService();
    await expect(service.prepareBatch({}, 'actor-1')).rejects.toThrow(BadRequestException);
  });

  it('odbija poziv kad su OBA načina izbora prosleđena istovremeno', async () => {
    const { service } = makeService();
    await expect(
      service.prepareBatch({ bookingIds: ['b-1'], createdFrom: '2027-01-01', createdTo: '2027-01-31' }, 'actor-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('checkbox izbor (bookingIds) filtrira stavke po tačno tim rezervacijama', async () => {
    const { service, prisma } = makeService();
    prisma.bookingItem.findMany.mockResolvedValue([]);

    await service.prepareBatch({ bookingIds: ['b-1', 'b-2'] }, 'actor-1');

    expect(prisma.bookingItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ bookingId: { in: ['b-1', 'b-2'] } }) }),
    );
  });

  it('opseg datuma (createdFrom/createdTo) filtrira po Booking.createdAt, ne po stayFrom/stayTo', async () => {
    const { service, prisma } = makeService();
    prisma.bookingItem.findMany.mockResolvedValue([]);

    await service.prepareBatch({ createdFrom: '2027-06-01', createdTo: '2027-06-30' }, 'actor-1');

    expect(prisma.bookingItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          booking: { createdAt: { gte: new Date('2027-06-01'), lte: new Date('2027-06-30') } },
        }),
      }),
    );
  });

  it('grupiše po dobavljaču isto kao prepareForBooking kad je obim više rezervacija umesto jedne', async () => {
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
        stayFrom: new Date('2027-07-10'),
        stayTo: new Date('2027-07-12'),
        rateLine: { contractPeriodId: 'period-hotel-2' },
        product: { sourceContract: { supplierId: 'supplier-hotel' } },
      },
      {
        id: 'bi-3',
        stayFrom: new Date('2027-06-02'),
        stayTo: new Date('2027-06-02'),
        rateLine: { contractPeriodId: 'period-transfer' },
        product: { sourceContract: { supplierId: 'supplier-transfer' } },
      },
    ];
    prisma.bookingItem.findMany.mockResolvedValue(items);
    prisma.supplier.findUniqueOrThrow.mockImplementation(({ where }: any) => Promise.resolve({ id: where.id, type: 'HOTEL' }));
    prisma.supplierManifest.create.mockImplementation(({ data }: any) => Promise.resolve({ id: `manifest-${data.supplierId}`, ...data }));

    const manifests = await service.prepareBatch({ bookingIds: ['b-1', 'b-2'] }, 'actor-1');

    expect(manifests).toHaveLength(2);
    const hotelManifest: any = manifests.find((m: any) => m.supplierId === 'supplier-hotel');
    // dve stavke od istog dobavljača ali iz DVE različite rezervacije/perioda -> jedna zajednička lista,
    // contractPeriodId ostaje null jer se periodi ne slažu (§8.1 "nullable ako lista objedinjuje više perioda").
    expect(hotelManifest.items).toEqual({ create: [{ bookingItemId: 'bi-1' }, { bookingItemId: 'bi-2' }] });
    expect(hotelManifest.contractPeriodId).toBeNull();
  });
});
