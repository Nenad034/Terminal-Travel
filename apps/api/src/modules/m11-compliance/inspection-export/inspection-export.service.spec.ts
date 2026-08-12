import { InspectionExportService } from './inspection-export.service';

describe('InspectionExportService (M11 spec §3)', () => {
  function makeService() {
    const prisma: any = {
      auditLogEntry: { findMany: jest.fn().mockResolvedValue([]) },
      booking: { findMany: jest.fn().mockResolvedValue([]) },
      fiscalDocument: { findMany: jest.fn().mockResolvedValue([]) },
      travelGuaranteeRegistration: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new InspectionExportService(prisma);
    return { service, prisma };
  }

  it('agregira podatke iz M1/M5/M10/M11 za zadati period', async () => {
    const { service, prisma } = makeService();

    const result = await service.generate({ periodFrom: '2026-01-01', periodTo: '2026-01-31' });

    expect(prisma.auditLogEntry.findMany).toHaveBeenCalled();
    expect(prisma.booking.findMany).toHaveBeenCalled();
    expect(prisma.fiscalDocument.findMany).toHaveBeenCalled();
    expect(prisma.travelGuaranteeRegistration.findMany).toHaveBeenCalled();
    expect(result.periodFrom).toBe('2026-01-01');
    expect(result.csv).toContain('== Rezervacije ==');
  });

  it('CSV izvoz sadrži redove za rezervacije, fiskalne dokumente i CIS registracije', async () => {
    const { service, prisma } = makeService();
    prisma.booking.findMany.mockResolvedValue([
      { bookingNumber: 'TT-1', status: 'CONFIRMED', tipNastupanja: 'ORGANIZATOR', totalPrice: 10000, currency: 'RSD', createdAt: new Date('2026-01-05') },
    ]);
    prisma.fiscalDocument.findMany.mockResolvedValue([
      { id: 'fd-1', documentType: 'ESIR_RACUN', status: 'SUBMITTED', externalReference: 'ESIR-1', amountRsd: 10000 },
    ]);
    prisma.travelGuaranteeRegistration.findMany.mockResolvedValue([{ bookingId: 'booking-1', status: 'REGISTERED', cisRegistrationNumber: 'CIS-1' }]);

    const result = await service.generate({ periodFrom: '2026-01-01', periodTo: '2026-01-31' });

    expect(result.csv).toContain('TT-1,CONFIRMED,ORGANIZATOR,10000,RSD');
    expect(result.csv).toContain('fd-1,ESIR_RACUN,SUBMITTED,ESIR-1,10000');
    expect(result.csv).toContain('booking-1,REGISTERED,CIS-1');
  });
});
