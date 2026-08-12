import { findBestSupplierObligationMatch } from './matching';

describe('findBestSupplierObligationMatch (M10 spec §8.6.3)', () => {
  function makePrisma() {
    return { supplierObligation: { findMany: jest.fn() } } as any;
  }

  it('predlaže kandidata sa preklapajućim periodom i podudarnim imenom gosta, visoka pouzdanost', async () => {
    const prisma = makePrisma();
    prisma.supplierObligation.findMany.mockResolvedValue([
      {
        id: 'so-1',
        amountOriginal: 50000,
        bookingItem: {
          stayFrom: new Date('2026-09-01'),
          stayTo: new Date('2026-09-10'),
          guests: [{ guestFirstName: 'Petar', guestLastName: 'Petrović' }],
        },
      },
    ]);

    const result = await findBestSupplierObligationMatch(prisma, {
      supplierId: 'supplier-1',
      extractedGuestName: 'Petar Petrovic', // bez dijakritika — mora i dalje da poklopi
      extractedStayFrom: new Date('2026-09-02'),
      extractedStayTo: new Date('2026-09-09'),
      extractedAmount: 50000,
    });

    expect(result.matchedSupplierObligationId).toBe('so-1');
    expect(result.matchConfidence).toBeGreaterThanOrEqual(85);
  });

  it('ne predlaže kandidata bez preklapanja perioda boravka', async () => {
    const prisma = makePrisma();
    prisma.supplierObligation.findMany.mockResolvedValue([
      {
        id: 'so-1',
        amountOriginal: 50000,
        bookingItem: {
          stayFrom: new Date('2026-09-01'),
          stayTo: new Date('2026-09-10'),
          guests: [{ guestFirstName: 'Petar', guestLastName: 'Petrović' }],
        },
      },
    ]);

    const result = await findBestSupplierObligationMatch(prisma, {
      supplierId: 'supplier-1',
      extractedGuestName: 'Petar Petrović',
      extractedStayFrom: new Date('2026-10-01'),
      extractedStayTo: new Date('2026-10-10'),
      extractedAmount: 50000,
    });

    expect(result.matchedSupplierObligationId).toBeNull();
  });

  it('ne predlaže kandidata kad se ime gosta ne poklapa dovoljno', async () => {
    const prisma = makePrisma();
    prisma.supplierObligation.findMany.mockResolvedValue([
      {
        id: 'so-1',
        amountOriginal: 50000,
        bookingItem: {
          stayFrom: new Date('2026-09-01'),
          stayTo: new Date('2026-09-10'),
          guests: [{ guestFirstName: 'Marko', guestLastName: 'Marković' }],
        },
      },
    ]);

    const result = await findBestSupplierObligationMatch(prisma, {
      supplierId: 'supplier-1',
      extractedGuestName: 'Sasvim Drugo Ime',
      extractedStayFrom: new Date('2026-09-02'),
      extractedStayTo: new Date('2026-09-09'),
      extractedAmount: 50000,
    });

    expect(result.matchedSupplierObligationId).toBeNull();
  });
});
