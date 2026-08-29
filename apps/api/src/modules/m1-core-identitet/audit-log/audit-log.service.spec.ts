import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('AuditLogService', () => {
  function makeService() {
    const prisma = { auditLogEntry: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() } } as unknown as jest.Mocked<PrismaService>;
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
});
