import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('AuditLogService', () => {
  // `find()` od 6.9.2026. radi kroz `$transaction([findMany, count])` — broj i redovi moraju
  // doći iz ISTOG trenutka, jer se u audit log upisuje neprestano (dok. 39 nalaz 2.2).
  function makeService(total = 0, rows: unknown[] = []) {
    const prisma = {
      auditLogEntry: {
        findMany: jest.fn().mockResolvedValue(rows),
        count: jest.fn().mockResolvedValue(total),
        create: jest.fn(),
      },
      $transaction: jest.fn((operacije: Promise<unknown>[]) => Promise.all(operacije)),
    } as unknown as jest.Mocked<PrismaService>;
    const service = new AuditLogService(prisma);
    return { service, prisma };
  }

  // Dopuna 29.8.2026, na zahtev vlasnika: "dodajte i pretragu po pojmu i datumu" (M1 spec §6/§7).
  it('find() bez "q" ne dodaje OR uslov', async () => {
    const { service, prisma } = makeService();
    await service.find({ module: 'M1' });
    const where = (prisma.auditLogEntry.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.OR).toBeUndefined();
  });

  it('find() sa "q" pretražuje action/resourceType/resourceId/module, case-insensitive', async () => {
    const { service, prisma } = makeService();
    await service.find({ q: 'login' });
    const where = (prisma.auditLogEntry.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { action: { contains: 'login', mode: 'insensitive' } },
      { resourceType: { contains: 'login', mode: 'insensitive' } },
      { resourceId: { contains: 'login', mode: 'insensitive' } },
      { module: { contains: 'login', mode: 'insensitive' } },
    ]);
  });

  it('find() kombinuje "q" sa module/from/to bez gubljenja ijednog uslova', async () => {
    const { service, prisma } = makeService();
    const from = new Date('2026-08-01T00:00:00.000Z');
    const to = new Date('2026-08-31T23:59:59.000Z');
    await service.find({ module: 'M10', q: 'faktura', from, to });
    const where = (prisma.auditLogEntry.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.module).toBe('M10');
    expect(where.timestamp).toEqual({ gte: from, lte: to });
    expect(where.OR).toHaveLength(4);
  });

  // --- Straničenje (6.9.2026, dok. 39 nalaz 2.2) ---
  //
  // Greška koju ovi testovi zaključavaju nije pad nego TIHO ODSECANJE: ranije je ovde stajalo
  // golo `take: 200`, pa je pretraga nad 1.240 zapisa vraćala 200 i ništa nije govorilo da
  // ostatak postoji. Takva greška se ne vidi u tipovima ni u izuzecima, samo u vrednostima.
  describe('straničenje', () => {
    it('bez parametara vraća prvu stranu od 50, ne sve i ne 200', async () => {
      const { service, prisma } = makeService(1240, [{ id: 'a' }]);
      const r = await service.find({});
      expect((prisma.auditLogEntry.findMany as jest.Mock).mock.calls[0][0]).toMatchObject({ skip: 0, take: 50 });
      expect(r.page).toBe(1);
      expect(r.limit).toBe(50);
    });

    it('`total` je STVARAN broj redova, ne broj vraćenih', async () => {
      const { service } = makeService(1240, [{ id: 'a' }, { id: 'b' }]);
      const r = await service.find({});
      expect(r.total).toBe(1240);
      expect(r.data).toHaveLength(2);
      expect(r.pageCount).toBe(25);
      expect(r.hasMore).toBe(true);
    });

    it('tražena strana preskače tačno prethodne strane', async () => {
      const { service, prisma } = makeService(1240, []);
      await service.find({}, { page: 3, limit: 20 });
      expect((prisma.auditLogEntry.findMany as jest.Mock).mock.calls[0][0]).toMatchObject({ skip: 40, take: 20 });
    });

    it('broj i redovi dolaze iz ISTE transakcije (ne iz dva odvojena trenutka)', async () => {
      const { service, prisma } = makeService(7, []);
      await service.find({});
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect((prisma.$transaction as unknown as jest.Mock).mock.calls[0][0]).toHaveLength(2);
    });

    it('brojanje koristi ISTI filter kao i upit — inače „prikazano 50 od N" laže', async () => {
      const { service, prisma } = makeService(3, []);
      await service.find({ module: 'M10', q: 'faktura' });
      const whereUpita = (prisma.auditLogEntry.findMany as jest.Mock).mock.calls[0][0].where;
      const whereBrojanja = (prisma.auditLogEntry.count as jest.Mock).mock.calls[0][0].where;
      expect(whereBrojanja).toBe(whereUpita);
    });
  });
});
