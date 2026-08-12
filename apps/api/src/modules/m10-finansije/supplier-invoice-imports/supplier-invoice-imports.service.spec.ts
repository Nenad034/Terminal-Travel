import { BadRequestException } from '@nestjs/common';
import { SupplierInvoiceImportsService } from './supplier-invoice-imports.service';

describe('SupplierInvoiceImportsService (M10 spec §8.6)', () => {
  function makeService() {
    const prisma: any = {
      supplierInvoiceImport: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      supplierInvoiceImportRow: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
      supplierObligation: { findUnique: jest.fn(), update: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const exchangeRates = { findForCurrencyOnOrBefore: jest.fn() };
    const service = new SupplierInvoiceImportsService(prisma, auditLog as any, exchangeRates as any);
    return { service, prisma, auditLog, exchangeRates };
  }

  describe('confirmRow (§8.6.4)', () => {
    it('odbija potvrdu bez matched_supplier_obligation_id (ni predlog ni ručno zadat)', async () => {
      const { service, prisma } = makeService();
      prisma.supplierInvoiceImportRow.findUnique.mockResolvedValue({
        id: 'row-1',
        supplierInvoiceImportId: 'imp-1',
        matchedSupplierObligationId: null,
      });

      await expect(service.confirmRow('imp-1', 'row-1', {}, { userId: 'actor-1' })).rejects.toThrow(BadRequestException);
    });

    it('upisuje invoice_reference u ciljanu obavezu i status CONFIRMED za predloženo mapiranje', async () => {
      const { service, prisma } = makeService();
      prisma.supplierInvoiceImportRow.findUnique.mockResolvedValue({
        id: 'row-1',
        supplierInvoiceImportId: 'imp-1',
        matchedSupplierObligationId: 'so-1',
        extractedAmount: 50000,
        extractedInvoiceReference: 'INV-2026-001',
      });
      prisma.supplierObligation.findUnique.mockResolvedValue({ id: 'so-1', currencyOriginal: 'RSD' });
      prisma.supplierObligation.update.mockResolvedValue({ id: 'so-1', invoiceReference: 'INV-2026-001' });
      prisma.supplierInvoiceImportRow.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 'row-1', ...data }));
      prisma.supplierInvoiceImportRow.count.mockResolvedValue(0);

      const result = await service.confirmRow('imp-1', 'row-1', {}, { userId: 'actor-1' });

      expect(result.reviewStatus).toBe('CONFIRMED');
      expect(prisma.supplierObligation.update).toHaveBeenCalledWith({
        where: { id: 'so-1' },
        data: expect.objectContaining({ invoiceReference: 'INV-2026-001', amountOriginal: 50000 }),
      });
    });

    it('koristi MANUALLY_MATCHED kad je operater zadao drugačiji cilj od predloženog', async () => {
      const { service, prisma } = makeService();
      prisma.supplierInvoiceImportRow.findUnique.mockResolvedValue({
        id: 'row-1',
        supplierInvoiceImportId: 'imp-1',
        matchedSupplierObligationId: 'so-suggested',
        extractedAmount: 50000,
        extractedInvoiceReference: 'INV-2026-001',
      });
      prisma.supplierObligation.findUnique.mockResolvedValue({ id: 'so-manual', currencyOriginal: 'RSD' });
      prisma.supplierObligation.update.mockResolvedValue({ id: 'so-manual' });
      prisma.supplierInvoiceImportRow.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 'row-1', ...data }));
      prisma.supplierInvoiceImportRow.count.mockResolvedValue(0);

      const result = await service.confirmRow(
        'imp-1',
        'row-1',
        { matchedSupplierObligationId: 'so-manual' },
        { userId: 'actor-1' },
      );

      expect(result.reviewStatus).toBe('MANUALLY_MATCHED');
    });

    it('primenjuje correctedAmount kad se razlikuje od automatski ekstrahovanog iznosa', async () => {
      const { service, prisma } = makeService();
      prisma.supplierInvoiceImportRow.findUnique.mockResolvedValue({
        id: 'row-1',
        supplierInvoiceImportId: 'imp-1',
        matchedSupplierObligationId: 'so-1',
        extractedAmount: 50000,
        extractedInvoiceReference: 'INV-2026-001',
      });
      prisma.supplierObligation.findUnique.mockResolvedValue({ id: 'so-1', currencyOriginal: 'RSD' });
      prisma.supplierObligation.update.mockResolvedValue({ id: 'so-1' });
      prisma.supplierInvoiceImportRow.update.mockResolvedValue({ id: 'row-1', reviewStatus: 'CONFIRMED' });
      prisma.supplierInvoiceImportRow.count.mockResolvedValue(0);

      await service.confirmRow('imp-1', 'row-1', { correctedAmount: 55000 }, { userId: 'actor-1' });

      expect(prisma.supplierObligation.update).toHaveBeenCalledWith({
        where: { id: 'so-1' },
        data: expect.objectContaining({ amountOriginal: 55000 }),
      });
    });
  });

  it('rejectRow postavlja REJECTED bez ikakvog efekta na SupplierObligation', async () => {
    const { service, prisma } = makeService();
    prisma.supplierInvoiceImportRow.findUnique.mockResolvedValue({ id: 'row-1', supplierInvoiceImportId: 'imp-1' });
    prisma.supplierInvoiceImportRow.update.mockResolvedValue({ id: 'row-1', reviewStatus: 'REJECTED' });
    prisma.supplierInvoiceImportRow.count.mockResolvedValue(0);

    const result = await service.rejectRow('imp-1', 'row-1', { userId: 'actor-1' });

    expect(result.reviewStatus).toBe('REJECTED');
    expect(prisma.supplierObligation.update).not.toHaveBeenCalled();
  });
});
