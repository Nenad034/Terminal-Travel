import { ReportsService } from './reports.service';

// M13 spec §4.4 (dopuna 8.9.2026) — "Vremenski obrasci". Zaseban fajl od ostatka ReportsService
// (koji do sad nije imao nijedan jedinični test — poznat, ranije zabeležen nedostatak, van obima
// ove dopune) da nova pokrivenost bude jasno vezana za ovu dopunu.
describe('ReportsService.temporal (M13 spec §4.4)', () => {
  function makeService() {
    const prisma = {
      searchLog: { findMany: jest.fn() },
      factBooking: { findMany: jest.fn() },
    };
    const permissions = { hasPermission: jest.fn() };
    const conversations = {};
    const service = new ReportsService(prisma as any, permissions as any, conversations as any);
    return { service, prisma };
  }

  it('inquiries_by_hour čita SearchLog i grupiše po satu/danu', async () => {
    const { service, prisma } = makeService();
    prisma.searchLog.findMany.mockResolvedValue([
      { occurredAt: new Date('2026-09-07T09:15:00Z') }, // ponedeljak, 09h (UTC == lokalno u testu)
      { occurredAt: new Date('2026-09-07T09:45:00Z') }, // isti sat/dan — spaja se u isti bucket
      { occurredAt: new Date('2026-09-08T14:00:00Z') }, // utorak, 14h
    ]);

    const result = await service.temporal({ dimension: 'inquiries_by_hour' });

    expect(prisma.searchLog.findMany).toHaveBeenCalledWith({
      where: {},
      select: { occurredAt: true },
    });
    expect(result.byHour).toHaveLength(2);
    const nineHourBucket = result.byHour!.find(
      (b) => b.hour === new Date('2026-09-07T09:15:00Z').getHours(),
    );
    expect(nineHourBucket?.count).toBe(2);
  });

  it('bookings_by_hour isključuje CANCELLED stavke i primenjuje period na bookingDate', async () => {
    const { service, prisma } = makeService();
    prisma.factBooking.findMany.mockResolvedValue([
      { bookingDate: new Date('2026-09-07T10:00:00Z') },
    ]);

    await service.temporal({ dimension: 'bookings_by_hour', from: '2026-09-01', to: '2026-09-08' });

    expect(prisma.factBooking.findMany).toHaveBeenCalledWith({
      where: {
        status: { not: 'CANCELLED' },
        bookingDate: { gte: new Date('2026-09-01'), lte: new Date('2026-09-08T23:59:59.999Z') },
      },
      select: { bookingDate: true },
    });
  });

  it('cancellations_by_hour čita samo stavke sa cancelledAt', async () => {
    const { service, prisma } = makeService();
    prisma.factBooking.findMany.mockResolvedValue([]);

    await service.temporal({ dimension: 'cancellations_by_hour' });

    expect(prisma.factBooking.findMany).toHaveBeenCalledWith({
      where: { cancelledAt: { not: null } },
      select: { cancelledAt: true },
    });
  });

  it('cancellation_lead_time razvrstava u kategorije 48h+/24-48h/<24h, ne prosek (dok. 40 pravilo 4)', async () => {
    const { service, prisma } = makeService();
    const stayFrom = new Date('2026-09-10T00:00:00Z');
    prisma.factBooking.findMany.mockResolvedValue([
      { stayFrom, cancelledAt: new Date('2026-09-01T00:00:00Z') }, // ~9 dana unapred → 48h+
      { stayFrom, cancelledAt: new Date('2026-09-08T12:00:00Z') }, // 36h unapred → 24-48h
      { stayFrom, cancelledAt: new Date('2026-09-09T18:00:00Z') }, // 6h unapred → <24h
    ]);

    const result = await service.temporal({ dimension: 'cancellation_lead_time' });

    expect(result.leadTime).toEqual([
      { key: '48h+', count: 1 },
      { key: '24-48h', count: 1 },
      { key: '<24h', count: 1 },
    ]);
  });
});
