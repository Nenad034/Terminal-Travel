import { BadRequestException } from '@nestjs/common';
import { PricelistImportsService } from './pricelist-imports.service';

describe('PricelistImportsService (M3 spec §4.2)', () => {
  function makeService() {
    const prisma = {
      pricelistImport: { findMany: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn() },
      pricelistImportRow: { findMany: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      product: { findUniqueOrThrow: jest.fn() },
      contractPeriod: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      rateLine: { create: jest.fn() },
      supplierExtractionProfile: { upsert: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const service = new PricelistImportsService(prisma as any, auditLog as any);
    return { service, prisma, auditLog };
  }

  describe('create (§4.2.1)', () => {
    it('kreira uvoz u statusu PROCESSING (stvarna ekstrakcija čeka AI provajdera)', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.pricelistImport.create.mockResolvedValue({ id: 'imp-1', status: 'PROCESSING' });

      const result = await service.create(
        { supplierId: 's1', sourceFileUrl: 'https://x.com/cenovnik.pdf', sourceFormat: 'PDF' as any },
        'actor-1',
      );

      expect(prisma.pricelistImport.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PROCESSING' }) }),
      );
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'pricelist_import.created' }));
      expect(result.status).toBe('PROCESSING');
    });
  });

  describe('reviewRow — REJECTED', () => {
    it('označava REJECTED bez upisa u ContractPeriod/RateLine', async () => {
      const { service, prisma } = makeService();
      prisma.pricelistImportRow.findUniqueOrThrow.mockResolvedValue({
        id: 'row-1',
        import: { id: 'imp-1', supplierId: 's1' },
      });
      prisma.pricelistImportRow.update.mockResolvedValue({ id: 'row-1', reviewStatus: 'REJECTED' });

      await service.reviewRow('imp-1', 'row-1', { decision: 'REJECTED' }, 'actor-1');

      expect(prisma.contractPeriod.create).not.toHaveBeenCalled();
      expect(prisma.rateLine.create).not.toHaveBeenCalled();
    });
  });

  describe('reviewRow — bezbednosna provera', () => {
    it('odbija kad red ne pripada navedenom uvozu', async () => {
      const { service, prisma } = makeService();
      prisma.pricelistImportRow.findUniqueOrThrow.mockResolvedValue({ id: 'row-1', import: { id: 'drugi-uvoz' } });

      await expect(service.reviewRow('imp-1', 'row-1', { decision: 'REJECTED' }, 'actor-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('reviewRow — CONFIRMED/MANUALLY_MATCHED zahteva matched_product_id', () => {
    it('odbija bez matchedProductId (ni na redu ni u zahtevu)', async () => {
      const { service, prisma } = makeService();
      prisma.pricelistImportRow.findUniqueOrThrow.mockResolvedValue({
        id: 'row-1',
        matchedProductId: null,
        import: { id: 'imp-1', supplierId: 's1' },
      });

      await expect(service.reviewRow('imp-1', 'row-1', { decision: 'CONFIRMED' }, 'actor-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('odbija kad poklopljeni proizvod nema source_contract_id (nije CONTRACTED)', async () => {
      const { service, prisma } = makeService();
      prisma.pricelistImportRow.findUniqueOrThrow.mockResolvedValue({
        id: 'row-1',
        matchedProductId: 'prod-1',
        import: { id: 'imp-1', supplierId: 's1' },
      });
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'prod-1', sourceContractId: null });

      await expect(service.reviewRow('imp-1', 'row-1', { decision: 'CONFIRMED' }, 'actor-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('odbija kad extracted_price_basis nije prepoznat (null) — ne pretpostavlja PER_ROOM/PER_PERSON', async () => {
      const { service, prisma } = makeService();
      prisma.pricelistImportRow.findUniqueOrThrow.mockResolvedValue({
        id: 'row-1',
        matchedProductId: 'prod-1',
        extractedPriceBasis: null,
        import: { id: 'imp-1', supplierId: 's1' },
      });
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'prod-1', sourceContractId: 'contract-1' });

      await expect(service.reviewRow('imp-1', 'row-1', { decision: 'CONFIRMED' }, 'actor-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('reviewRow — uspešna primena (§4.2.4)', () => {
    function fullRow(overrides: Record<string, unknown> = {}) {
      return {
        id: 'row-1',
        matchedProductId: 'prod-1',
        extractedRoomType: 'DELUXE',
        extractedBoardType: 'polupansion',
        extractedOccupancy: 'odrasla osoba u dvokrevetnoj',
        extractedStayFrom: new Date('2027-07-01'),
        extractedStayTo: new Date('2027-07-31'),
        extractedPrice: 10000,
        extractedPriceBasis: 'PER_ROOM_PER_NIGHT',
        extractedCribFeePerNight: null,
        extractedAgePricing: null,
        import: { id: 'imp-1', supplierId: 's1' },
        ...overrides,
      };
    }

    it('kreira ContractPeriod kao ON_REQUEST (cenovnik ne nosi kapacitet) i RateLine sa ekstraktovanim vrednostima', async () => {
      const { service, prisma } = makeService();
      prisma.pricelistImportRow.findUniqueOrThrow.mockResolvedValue(fullRow());
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'prod-1', sourceContractId: 'contract-1' });
      prisma.contractPeriod.create.mockResolvedValue({ id: 'period-1' });
      prisma.rateLine.create.mockResolvedValue({ id: 'rate-1' });
      prisma.pricelistImportRow.update.mockResolvedValue({ id: 'row-1', reviewStatus: 'CONFIRMED' });

      await service.reviewRow('imp-1', 'row-1', { decision: 'CONFIRMED' }, 'actor-1');

      expect(prisma.contractPeriod.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contractId: 'contract-1', roomType: 'DELUXE', allotmentMode: 'ON_REQUEST' }),
        }),
      );
      expect(prisma.rateLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contractPeriodId: 'period-1',
            boardType: 'polupansion',
            occupancy: 'odrasla osoba u dvokrevetnoj',
            price: 10000,
          }),
        }),
      );
    });

    it('proverava preklapanje perioda pre kreiranja (§2.3b)', async () => {
      const { service, prisma } = makeService();
      prisma.pricelistImportRow.findUniqueOrThrow.mockResolvedValue(fullRow());
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'prod-1', sourceContractId: 'contract-1' });
      prisma.contractPeriod.findFirst.mockResolvedValue({
        id: 'existing',
        stayFrom: new Date('2027-07-01'),
        stayTo: new Date('2027-07-31'),
      });

      await expect(service.reviewRow('imp-1', 'row-1', { decision: 'CONFIRMED' }, 'actor-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.contractPeriod.create).not.toHaveBeenCalled();
    });

    it('ažurira SupplierExtractionProfile dobavljača posle odobrenja (§4.2.5)', async () => {
      const { service, prisma } = makeService();
      prisma.pricelistImportRow.findUniqueOrThrow.mockResolvedValue(fullRow());
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'prod-1', sourceContractId: 'contract-1' });
      prisma.contractPeriod.create.mockResolvedValue({ id: 'period-1' });
      prisma.rateLine.create.mockResolvedValue({ id: 'rate-1' });
      prisma.pricelistImportRow.update.mockResolvedValue({ id: 'row-1' });

      await service.reviewRow('imp-1', 'row-1', { decision: 'CONFIRMED' }, 'actor-1');

      expect(prisma.supplierExtractionProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { supplierId: 's1' } }),
      );
    });

    it('MANUALLY_MATCHED sa matchedProductId u zahtevu koristi taj proizvod (ignoriše AI predlog)', async () => {
      const { service, prisma } = makeService();
      prisma.pricelistImportRow.findUniqueOrThrow.mockResolvedValue(fullRow({ matchedProductId: 'ai-predlog' }));
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'rucno-izabran', sourceContractId: 'contract-2' });
      prisma.contractPeriod.create.mockResolvedValue({ id: 'period-1' });
      prisma.rateLine.create.mockResolvedValue({ id: 'rate-1' });
      prisma.pricelistImportRow.update.mockResolvedValue({ id: 'row-1' });

      await service.reviewRow(
        'imp-1',
        'row-1',
        { decision: 'MANUALLY_MATCHED', matchedProductId: 'rucno-izabran' },
        'actor-1',
      );

      expect(prisma.product.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'rucno-izabran' } });
      expect(prisma.pricelistImportRow.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ matchedProductId: 'rucno-izabran' }) }),
      );
    });

    it('kreira RateLineAgePricing kad red nosi extractedAgePricing kandidate', async () => {
      const { service, prisma } = makeService();
      prisma.pricelistImportRow.findUniqueOrThrow.mockResolvedValue(
        fullRow({
          extractedAgePricing: [
            { age_category: 'CHILD', pricing_mode: 'PERCENTAGE_OF_BASE_PRICE', percentage: 50 },
          ],
        }),
      );
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'prod-1', sourceContractId: 'contract-1' });
      prisma.contractPeriod.create.mockResolvedValue({ id: 'period-1' });
      prisma.rateLine.create.mockResolvedValue({ id: 'rate-1' });
      prisma.pricelistImportRow.update.mockResolvedValue({ id: 'row-1' });

      await service.reviewRow('imp-1', 'row-1', { decision: 'CONFIRMED' }, 'actor-1');

      const rateLineCall = prisma.rateLine.create.mock.calls[0][0];
      expect(rateLineCall.data.agePricing.create).toEqual([
        expect.objectContaining({ ageCategory: 'CHILD', pricingMode: 'PERCENTAGE_OF_BASE_PRICE', percentage: 50 }),
      ]);
    });
  });

  describe('maybeComplete', () => {
    it('postavlja import status na COMPLETED kad nema više PENDING redova', async () => {
      const { service, prisma } = makeService();
      prisma.pricelistImportRow.findUniqueOrThrow.mockResolvedValue({
        id: 'row-1',
        import: { id: 'imp-1', supplierId: 's1' },
      });
      prisma.pricelistImportRow.update.mockResolvedValue({ id: 'row-1' });
      prisma.pricelistImportRow.count.mockResolvedValue(0);

      await service.reviewRow('imp-1', 'row-1', { decision: 'REJECTED' }, 'actor-1');

      expect(prisma.pricelistImport.update).toHaveBeenCalledWith({ where: { id: 'imp-1' }, data: { status: 'COMPLETED' } });
    });
  });
});
