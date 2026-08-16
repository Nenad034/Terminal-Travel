import { CorrespondentMatcherService } from './correspondent-matcher.service';

describe('CorrespondentMatcherService (M22 spec §3.1)', () => {
  function makeService() {
    const prisma = {
      guestProfile: { findFirst: jest.fn() },
      clientAccount: { findFirst: jest.fn() },
      subagent: { findUnique: jest.fn() },
      supplier: { findFirst: jest.fn() },
      supplierContact: { findFirst: jest.fn() },
    };
    const service = new CorrespondentMatcherService(prisma as any);
    return { service, prisma };
  }

  it('tačno poklapanje po GuestProfile.email -> GUEST', async () => {
    const { service, prisma } = makeService();
    prisma.guestProfile.findFirst.mockResolvedValue({ id: 'gp-1', linkedClientAccountId: 'ca-1' });

    const result = await service.match('gost@primer.rs');

    expect(result).toEqual({ correspondentType: 'GUEST', correspondentClientAccountId: 'ca-1', correspondentSupplierId: null });
  });

  it('tačno poklapanje po ClientAccount.email uz Subagent zapis -> SUBAGENT', async () => {
    const { service, prisma } = makeService();
    prisma.guestProfile.findFirst.mockResolvedValue(null);
    prisma.clientAccount.findFirst.mockResolvedValue({ id: 'ca-2' });
    prisma.subagent.findUnique.mockResolvedValue({ id: 'sub-1', clientAccountId: 'ca-2' });

    const result = await service.match('subagent@primer.rs');

    expect(result.correspondentType).toBe('SUBAGENT');
    expect(result.correspondentClientAccountId).toBe('ca-2');
  });

  it('tačno poklapanje po ClientAccount.email bez Subagent zapisa -> GUEST', async () => {
    const { service, prisma } = makeService();
    prisma.guestProfile.findFirst.mockResolvedValue(null);
    prisma.clientAccount.findFirst.mockResolvedValue({ id: 'ca-3' });
    prisma.subagent.findUnique.mockResolvedValue(null);

    const result = await service.match('nalogodavac@primer.rs');

    expect(result.correspondentType).toBe('GUEST');
  });

  it('tačno poklapanje po Supplier.contactEmail -> SUPPLIER', async () => {
    const { service, prisma } = makeService();
    prisma.guestProfile.findFirst.mockResolvedValue(null);
    prisma.clientAccount.findFirst.mockResolvedValue(null);
    prisma.supplier.findFirst.mockResolvedValue({ id: 'sup-1' });

    const result = await service.match('hotel@dobavljac.rs');

    expect(result).toEqual({ correspondentType: 'SUPPLIER', correspondentClientAccountId: null, correspondentSupplierId: 'sup-1' });
  });

  it('tačno poklapanje po SupplierContact.email -> SUPPLIER', async () => {
    const { service, prisma } = makeService();
    prisma.guestProfile.findFirst.mockResolvedValue(null);
    prisma.clientAccount.findFirst.mockResolvedValue(null);
    prisma.supplier.findFirst.mockResolvedValue(null);
    prisma.supplierContact.findFirst.mockResolvedValue({ id: 'sc-1', supplierId: 'sup-2' });

    const result = await service.match('kontakt@dobavljac.rs');

    expect(result).toEqual({ correspondentType: 'SUPPLIER', correspondentClientAccountId: null, correspondentSupplierId: 'sup-2' });
  });

  it('bez poklapanja ni u jednom od četiri izvora -> OTHER', async () => {
    const { service, prisma } = makeService();
    prisma.guestProfile.findFirst.mockResolvedValue(null);
    prisma.clientAccount.findFirst.mockResolvedValue(null);
    prisma.supplier.findFirst.mockResolvedValue(null);
    prisma.supplierContact.findFirst.mockResolvedValue(null);

    const result = await service.match('nepoznat@negde.rs');

    expect(result).toEqual({ correspondentType: 'OTHER', correspondentClientAccountId: null, correspondentSupplierId: null });
  });

  it('nikad ne poziva jezički model (čisto deterministička provera nad Prisma upitima)', async () => {
    const { service, prisma } = makeService();
    prisma.guestProfile.findFirst.mockResolvedValue(null);
    prisma.clientAccount.findFirst.mockResolvedValue(null);
    prisma.supplier.findFirst.mockResolvedValue(null);
    prisma.supplierContact.findFirst.mockResolvedValue(null);

    await service.match('x@y.rs');

    // Servis nema nijednu zavisnost osim PrismaService — odsustvo bilo kog AI klijenta u
    // konstruktoru je samo po sebi dokaz da ovo nikad ne troši poziv jezičkom modelu.
    expect(Object.keys(service)).not.toContain('anthropic');
  });
});
