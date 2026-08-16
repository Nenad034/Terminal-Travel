import { ReferenceMatcherService } from './reference-matcher.service';

describe('ReferenceMatcherService (M22 spec §3.1a)', () => {
  function makeService() {
    const prisma = {
      supplierManifest: { findUnique: jest.fn(), findFirst: jest.fn() },
      supplierChangeNotice: { findUnique: jest.fn() },
      supplier: { findMany: jest.fn() },
    };
    const service = new ReferenceMatcherService(prisma as any);
    return { service, prisma };
  }

  it('izvlači [REF: TT-NNNNNN] iz naslova i poklapa SupplierManifest -> EXACT_REFERENCE', async () => {
    const { service, prisma } = makeService();
    prisma.supplierManifest.findUnique.mockResolvedValue({ id: 'sm-1' });

    const result = await service.match('Potvrda [REF: TT-000123]', 'telo poruke', 'hotel@dobavljac.rs');

    expect(result).toEqual({ matchType: 'EXACT_REFERENCE', relatedSupplierManifestId: 'sm-1', relatedSupplierChangeNoticeId: null });
    expect(prisma.supplierManifest.findUnique).toHaveBeenCalledWith({ where: { referenceCode: 'TT-000123' } });
  });

  it('izvlači referencu iz tela poruke ako nije u naslovu, poklapa SupplierChangeNotice', async () => {
    const { service, prisma } = makeService();
    prisma.supplierManifest.findUnique.mockResolvedValue(null);
    prisma.supplierChangeNotice.findUnique.mockResolvedValue({ id: 'scn-1' });

    const result = await service.match('Re: pitanje', 'U vezi promene [ref: tt-000999] hvala', 'x@y.rs');

    expect(result).toEqual({ matchType: 'EXACT_REFERENCE', relatedSupplierManifestId: null, relatedSupplierChangeNoticeId: 'scn-1' });
  });

  it('bez tačne reference, fuzzy fallback po domenu -> FUZZY_SUGGESTION, jasno drugačiji matchType', async () => {
    const { service, prisma } = makeService();
    prisma.supplierManifest.findUnique.mockResolvedValue(null);
    prisma.supplierChangeNotice.findUnique.mockResolvedValue(null);
    prisma.supplier.findMany.mockResolvedValue([{ id: 'sup-1' }]);
    prisma.supplierManifest.findFirst.mockResolvedValue({ id: 'sm-2' });

    const result = await service.match('Bez reference', 'telo', 'nekoja-osoba@dobavljac.rs');

    expect(result.matchType).toBe('FUZZY_SUGGESTION');
    expect(result.relatedSupplierManifestId).toBe('sm-2');
  });

  it('bez tačne reference i bez fuzzy poklapanja -> NONE', async () => {
    const { service, prisma } = makeService();
    prisma.supplierManifest.findUnique.mockResolvedValue(null);
    prisma.supplierChangeNotice.findUnique.mockResolvedValue(null);
    prisma.supplier.findMany.mockResolvedValue([]);

    const result = await service.match('Bez reference', 'telo', 'nepoznat@negde.rs');

    expect(result).toEqual({ matchType: 'NONE', relatedSupplierManifestId: null, relatedSupplierChangeNoticeId: null });
  });
});
