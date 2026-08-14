import { AgentInboxService } from './agent-inbox.service';

// M15 spec §6 v1.10 — svaki izvor se prikazuje SAMO ako pozivalac ima odgovarajuću VIEW
// dozvolu tog modula (isti princip kao M17 dashboard).
describe('AgentInboxService', () => {
  function makePrisma(counts: Partial<Record<'pricelistImportRow' | 'supplierManifest' | 'commissionRebate' | 'contentPiece' | 'ticketMessage', number>>) {
    return {
      pricelistImportRow: { count: jest.fn().mockResolvedValue(counts.pricelistImportRow ?? 0) },
      supplierManifest: { count: jest.fn().mockResolvedValue(counts.supplierManifest ?? 0) },
      commissionRebate: { count: jest.fn().mockResolvedValue(counts.commissionRebate ?? 0) },
      contentPiece: { count: jest.fn().mockResolvedValue(counts.contentPiece ?? 0) },
      ticketMessage: { count: jest.fn().mockResolvedValue(counts.ticketMessage ?? 0) },
    };
  }

  it('vraća prazan niz kad pozivalac nema nijednu relevantnu VIEW dozvolu', async () => {
    const prisma = makePrisma({});
    const permissions = { hasPermission: jest.fn().mockResolvedValue(false) };
    const service = new AgentInboxService(prisma as any, permissions as any);

    const result = await service.get('u1');

    expect(result).toEqual([]);
    expect(prisma.pricelistImportRow.count).not.toHaveBeenCalled();
  });

  it('uključuje samo izvore za koje pozivalac ima VIEW dozvolu, sa tačnim brojem stavki', async () => {
    const prisma = makePrisma({ supplierManifest: 3, commissionRebate: 1 });
    const permissions = {
      hasPermission: jest.fn().mockImplementation((_userId: string, moduleCode: string) => Promise.resolve(moduleCode === 'M5' || moduleCode === 'M7')),
    };
    const service = new AgentInboxService(prisma as any, permissions as any);

    const result = await service.get('u1');

    expect(result).toEqual([
      { moduleCode: 'M5', actionCode: 'supplier_manifest.send', label: 'Operativne liste spremne za slanje dobavljaču', count: 3 },
      { moduleCode: 'M7', actionCode: 'commission_rebate.apply', label: 'Rabati provizije na čekanju odobrenja', count: 1 },
    ]);
    expect(prisma.pricelistImportRow.count).not.toHaveBeenCalled();
    expect(prisma.contentPiece.count).not.toHaveBeenCalled();
    expect(prisma.ticketMessage.count).not.toHaveBeenCalled();
  });

  it('svih pet izvora kad pozivalac ima sve relevantne dozvole (npr. Vlasnik/Direktor)', async () => {
    const prisma = makePrisma({
      pricelistImportRow: 2,
      supplierManifest: 0,
      commissionRebate: 0,
      contentPiece: 4,
      ticketMessage: 1,
    });
    const permissions = { hasPermission: jest.fn().mockResolvedValue(true) };
    const service = new AgentInboxService(prisma as any, permissions as any);

    const result = await service.get('vlasnik-1');

    expect(result).toHaveLength(5);
    expect(result.map((s) => s.moduleCode)).toEqual(['M3', 'M5', 'M7', 'M12', 'M14']);
  });
});
