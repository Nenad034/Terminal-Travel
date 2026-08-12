import { BadRequestException } from '@nestjs/common';
import { SupplierObligationsService } from './supplier-obligations.service';

describe('SupplierObligationsService (M10 spec §8)', () => {
  function makeService() {
    const prisma: any = {
      supplierObligation: { findFirst: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      bookingItem: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      contract: { findUnique: jest.fn() },
      exchangeRateSnapshot: { findUniqueOrThrow: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const exchangeRates = { findForCurrencyOnOrBefore: jest.fn() };
    const service = new SupplierObligationsService(prisma, auditLog as any, exchangeRates as any);
    return { service, prisma, auditLog, exchangeRates };
  }

  describe('createFromBookingItem (§8.0)', () => {
    it('kreira obavezu za CONTRACTED stavku, popunjava booking_item_id odmah', async () => {
      const { service, prisma } = makeService();
      prisma.supplierObligation.findFirst.mockResolvedValue(null);
      prisma.bookingItem.findUnique.mockResolvedValue({
        id: 'bi-1',
        sourceType: 'CONTRACTED',
        productId: 'p1',
        baseCost: 50000,
        baseCostCurrency: 'EUR',
      });
      prisma.product.findUnique.mockResolvedValue({ sourceContractId: 'contract-1' });
      prisma.contract.findUnique.mockResolvedValue({ supplierId: 'supplier-1', paymentTermsDays: 15 });
      prisma.supplierObligation.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'so-1', ...data }));

      const obligation: any = await service.createFromBookingItem('bi-1');

      expect(obligation.bookingItemId).toBe('bi-1');
      expect(obligation.supplierId).toBe('supplier-1');
      expect(obligation.amountOriginal).toBe(50000);
      const daysDiff = (obligation.dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(daysDiff).toBeCloseTo(15, 0);
    });

    it('ne kreira obavezu za API stavku (§8.0 — samo CONTRACTED)', async () => {
      const { service, prisma } = makeService();
      prisma.supplierObligation.findFirst.mockResolvedValue(null);
      prisma.bookingItem.findUnique.mockResolvedValue({ id: 'bi-2', sourceType: 'API' });

      const result = await service.createFromBookingItem('bi-2');

      expect(result).toBeNull();
      expect(prisma.supplierObligation.create).not.toHaveBeenCalled();
    });

    it('je idempotentno — vraća postojeću obavezu ako već postoji za bookingItemId', async () => {
      const { service, prisma } = makeService();
      prisma.supplierObligation.findFirst.mockResolvedValue({ id: 'so-existing' });

      const result = await service.createFromBookingItem('bi-1');

      expect(result).toEqual({ id: 'so-existing' });
      expect(prisma.bookingItem.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('approve (§8.3)', () => {
    it('odbija prelazak u APPROVED bez popunjenog bookingItemId', async () => {
      const { service, prisma } = makeService();
      prisma.supplierObligation.findUnique.mockResolvedValue({ id: 'so-1', bookingItemId: null, status: 'PENDING' });

      await expect(service.approve('so-1', { userId: 'actor-1' })).rejects.toThrow(BadRequestException);
    });

    it('odobrava kad je bookingItemId popunjen i status PENDING', async () => {
      const { service, prisma } = makeService();
      const obligation = { id: 'so-1', bookingItemId: 'bi-1', status: 'PENDING' };
      prisma.supplierObligation.findUnique.mockResolvedValue(obligation);
      prisma.supplierObligation.update.mockResolvedValue({ ...obligation, status: 'APPROVED' });

      const result = await service.approve('so-1', { userId: 'actor-1' });

      expect(result.status).toBe('APPROVED');
    });
  });

  describe('pay (§8.1 — exchange_rate_difference)', () => {
    it('izračunava razliku kursa kad se kurs na dan fakture razlikuje od kursa na dan plaćanja', async () => {
      const { service, prisma, exchangeRates } = makeService();
      const obligation = {
        id: 'so-1',
        status: 'APPROVED',
        amountOriginal: 100000, // 1000 EUR u centima
        currencyOriginal: 'EUR',
        exchangeRateSnapshotIdAtInvoice: 'ex-invoice',
      };
      prisma.supplierObligation.findUnique.mockResolvedValue(obligation);
      exchangeRates.findForCurrencyOnOrBefore.mockResolvedValue({ id: 'ex-payment', nbsMiddleRate: 118 });
      prisma.exchangeRateSnapshot.findUniqueOrThrow.mockResolvedValue({ nbsMiddleRate: 117 });
      prisma.supplierObligation.update.mockImplementation(({ data }: any) => Promise.resolve({ ...obligation, ...data }));

      const result = await service.pay('so-1', {}, { userId: 'actor-1' });

      expect(result.status).toBe('PAID');
      // (118 - 117) * 100000 = 100000
      expect(result.exchangeRateDifference).toBe(100000);
      expect(result.exchangeRateSnapshotIdAtPayment).toBe('ex-payment');
    });

    it('odbija plaćanje obaveze koja nije APPROVED', async () => {
      const { service, prisma } = makeService();
      prisma.supplierObligation.findUnique.mockResolvedValue({ id: 'so-1', status: 'PENDING' });

      await expect(service.pay('so-1', {}, { userId: 'actor-1' })).rejects.toThrow(BadRequestException);
    });
  });
});
