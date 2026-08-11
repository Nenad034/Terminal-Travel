import { BadRequestException } from '@nestjs/common';
import { ProductContentImportsService } from './product-content-imports.service';

describe('ProductContentImportsService (M2 spec §3.3/§3.3a)', () => {
  function makeService() {
    const prisma = {
      productContentImport: {
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      productContentImportField: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      product: {
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      productTranslation: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };
    const auditLog = { write: jest.fn() };
    const service = new ProductContentImportsService(prisma as any, auditLog as any);
    return { service, prisma, auditLog };
  }

  describe('create — MANUAL_URL (§3.3)', () => {
    it('zahteva source_url', async () => {
      const { service } = makeService();
      await expect(service.create({ origin: 'MANUAL_URL' as any }, 'actor-1')).rejects.toThrow(BadRequestException);
    });

    it('kreira uvoz sa status=FAILED i jasnim razlogom (AI ekstrakcija još nije povezana)', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.productContentImport.create.mockResolvedValue({ id: 'imp-1', status: 'FAILED' });

      const result = await service.create(
        { origin: 'MANUAL_URL' as any, sourceUrl: 'https://hotel-example.com' },
        'actor-1',
      );

      const createCall = prisma.productContentImport.create.mock.calls[0][0];
      expect(createCall.data.status).toBe('FAILED');
      expect(createCall.data.failureReason).toMatch(/AI provajder/);
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'product_content_import.created' }));
      expect(result.status).toBe('FAILED');
    });
  });

  describe('create — M23_RESEARCH (§3.3a)', () => {
    it('zahteva product_id', async () => {
      const { service } = makeService();
      await expect(
        service.create({ origin: 'M23_RESEARCH' as any, fields: [] }, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('ulazi direktno u status=EXTRACTED (preskače PENDING), sa poljima iz fields[]', async () => {
      const { service, prisma } = makeService();
      prisma.productContentImport.create.mockResolvedValue({
        id: 'imp-2',
        status: 'EXTRACTED',
        fields: [{ id: 'f1' }],
      });

      await service.create(
        {
          origin: 'M23_RESEARCH' as any,
          productId: 'p1',
          fields: [{ fieldType: 'AMENITY' as any, extractedValue: { value: 'Bazen' } }],
        },
        'actor-1',
      );

      const createCall = prisma.productContentImport.create.mock.calls[0][0];
      expect(createCall.data.status).toBe('EXTRACTED');
      expect(createCall.data.origin).toBe('M23_RESEARCH');
      expect(createCall.data.fields.create).toHaveLength(1);
    });
  });

  describe('reviewField — REJECTED (§3.3 korak 3)', () => {
    it('označava REJECTED bez upisa u Product', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.productContentImportField.findUniqueOrThrow.mockResolvedValue({
        id: 'f1',
        import: { id: 'imp-1', productId: 'p1' },
        extractedValue: { value: 'x' },
        fieldType: 'AMENITY',
      });
      prisma.productContentImportField.update.mockResolvedValue({ id: 'f1', reviewStatus: 'REJECTED' });

      await service.reviewField('imp-1', 'f1', { decision: 'REJECTED' }, 'actor-1');

      expect(prisma.product.update).not.toHaveBeenCalled();
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'product_content_import_field.rejected' }));
    });
  });

  describe('reviewField — nikad se ne primenjuje bez ljudskog reviewedBy (§3.3 tvrdo pravilo)', () => {
    it('APPROVED upisuje reviewedBy=actorId i appliedAt', async () => {
      const { service, prisma } = makeService();
      prisma.productContentImportField.findUniqueOrThrow.mockResolvedValue({
        id: 'f1',
        import: { id: 'imp-1', productId: 'p1' },
        extractedValue: { value: 'Bazen' },
        fieldType: 'AMENITY',
      });
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'p1', attributes: {} });
      prisma.productContentImportField.update.mockResolvedValue({ id: 'f1', reviewStatus: 'APPROVED' });

      await service.reviewField('imp-1', 'f1', { decision: 'APPROVED' }, 'actor-vlasnik');

      const updateCall = prisma.productContentImportField.update.mock.calls[0][0];
      expect(updateCall.data.reviewedBy).toBe('actor-vlasnik');
      expect(updateCall.data.appliedAt).toBeInstanceOf(Date);
    });
  });

  describe('primena po field_type (§3.3 korak 4)', () => {
    it('AMENITY se dodaje u attributes.amenities[]', async () => {
      const { service, prisma } = makeService();
      prisma.productContentImportField.findUniqueOrThrow.mockResolvedValue({
        id: 'f1',
        import: { id: 'imp-1', productId: 'p1' },
        extractedValue: { value: 'Bazen' },
        fieldType: 'AMENITY',
      });
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'p1', attributes: { amenities: ['Wifi'] } });
      prisma.productContentImportField.update.mockResolvedValue({});

      await service.reviewField('imp-1', 'f1', { decision: 'APPROVED' }, 'actor-1');

      const productUpdateCall = prisma.product.update.mock.calls[0][0];
      expect(productUpdateCall.data.attributes.amenities).toEqual(['Wifi', 'Bazen']);
    });

    it('ROOM_TYPE se dodaje u attributes.room_types[]', async () => {
      const { service, prisma } = makeService();
      prisma.productContentImportField.findUniqueOrThrow.mockResolvedValue({
        id: 'f1',
        import: { id: 'imp-1', productId: 'p1' },
        extractedValue: { code: 'DELUXE', name: 'Deluxe' },
        fieldType: 'ROOM_TYPE',
      });
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'p1', attributes: {} });
      prisma.productContentImportField.update.mockResolvedValue({});

      await service.reviewField('imp-1', 'f1', { decision: 'APPROVED' }, 'actor-1');

      const productUpdateCall = prisma.product.update.mock.calls[0][0];
      expect(productUpdateCall.data.attributes.room_types).toEqual([{ code: 'DELUXE', name: 'Deluxe' }]);
    });

    it('PHOTO se dodaje u media[] sa source=AI_IMPORTED', async () => {
      const { service, prisma } = makeService();
      prisma.productContentImportField.findUniqueOrThrow.mockResolvedValue({
        id: 'f1',
        import: { id: 'imp-1', productId: 'p1' },
        extractedValue: { url: 'https://hotel.com/photo.jpg', category: 'EXTERIOR' },
        fieldType: 'PHOTO',
      });
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'p1', media: [] });
      prisma.productContentImportField.update.mockResolvedValue({});

      await service.reviewField('imp-1', 'f1', { decision: 'APPROVED' }, 'actor-1');

      const productUpdateCall = prisma.product.update.mock.calls[0][0];
      expect(productUpdateCall.data.media[0]).toMatchObject({
        url: 'https://hotel.com/photo.jpg',
        source: 'AI_IMPORTED',
        category: 'EXTERIOR',
      });
    });

    it('NAME upisuje ProductTranslation na jeziku "en" sa translationSource=AI_GENERATED i isReviewed=true', async () => {
      const { service, prisma } = makeService();
      prisma.productContentImportField.findUniqueOrThrow.mockResolvedValue({
        id: 'f1',
        import: { id: 'imp-1', productId: 'p1' },
        extractedValue: { value: 'Hotel Example' },
        fieldType: 'NAME',
      });
      prisma.productTranslation.findUnique.mockResolvedValue(null);
      prisma.productContentImportField.update.mockResolvedValue({});

      await service.reviewField('imp-1', 'f1', { decision: 'APPROVED' }, 'actor-1');

      const upsertCall = prisma.productTranslation.upsert.mock.calls[0][0];
      expect(upsertCall.where.productId_languageCode).toEqual({ productId: 'p1', languageCode: 'en' });
      expect(upsertCall.create.name).toBe('Hotel Example');
      expect(upsertCall.create.translationSource).toBe('AI_GENERATED');
      expect(upsertCall.create.isReviewed).toBe(true);
    });

    it('EDITED_AND_APPROVED primenjuje editedValue umesto extractedValue', async () => {
      const { service, prisma } = makeService();
      prisma.productContentImportField.findUniqueOrThrow.mockResolvedValue({
        id: 'f1',
        import: { id: 'imp-1', productId: 'p1' },
        extractedValue: { value: 'Pogrešno prepoznato' },
        fieldType: 'AMENITY',
      });
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'p1', attributes: {} });
      prisma.productContentImportField.update.mockResolvedValue({});

      await service.reviewField(
        'imp-1',
        'f1',
        { decision: 'EDITED_AND_APPROVED', editedValue: { value: 'Ispravna vrednost' } },
        'actor-1',
      );

      const productUpdateCall = prisma.product.update.mock.calls[0][0];
      expect(productUpdateCall.data.attributes.amenities).toEqual(['Ispravna vrednost']);
    });
  });

  describe('kreiranje proizvoda kad productId nedostaje (§3.3 — uvoz koji kreira nov proizvod)', () => {
    it('prvo odobreno polje kreira Product tipa ACCOMMODATION/CONTRACTED/DRAFT i vezuje ga za uvoz', async () => {
      const { service, prisma } = makeService();
      prisma.productContentImportField.findUniqueOrThrow.mockResolvedValue({
        id: 'f1',
        import: { id: 'imp-1', productId: null },
        extractedValue: { value: 'Bazen' },
        fieldType: 'AMENITY',
      });
      prisma.product.create.mockResolvedValue({ id: 'novi-proizvod', attributes: {} });
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'novi-proizvod', attributes: {} });
      prisma.productContentImportField.update.mockResolvedValue({});

      await service.reviewField('imp-1', 'f1', { decision: 'APPROVED' }, 'actor-1');

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'ACCOMMODATION', sourceType: 'CONTRACTED', status: 'DRAFT' }),
        }),
      );
      expect(prisma.productContentImport.update).toHaveBeenCalledWith({
        where: { id: 'imp-1' },
        data: { productId: 'novi-proizvod' },
      });
    });
  });

  describe('maybeComplete — status uvoza (§3.3 korak 5)', () => {
    it('COMPLETED kad nema više PENDING polja', async () => {
      const { service, prisma } = makeService();
      prisma.productContentImportField.findUniqueOrThrow.mockResolvedValue({
        id: 'f1',
        import: { id: 'imp-1', productId: 'p1' },
        extractedValue: { value: 'x' },
        fieldType: 'AMENITY',
      });
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'p1', attributes: {} });
      prisma.productContentImportField.update.mockResolvedValue({});
      prisma.productContentImportField.count.mockResolvedValue(0);

      await service.reviewField('imp-1', 'f1', { decision: 'APPROVED' }, 'actor-1');

      expect(prisma.productContentImport.update).toHaveBeenCalledWith({
        where: { id: 'imp-1' },
        data: { status: 'COMPLETED' },
      });
    });

    it('REVIEW_IN_PROGRESS kad ima još PENDING polja', async () => {
      const { service, prisma } = makeService();
      prisma.productContentImportField.findUniqueOrThrow.mockResolvedValue({
        id: 'f1',
        import: { id: 'imp-1', productId: 'p1' },
        extractedValue: { value: 'x' },
        fieldType: 'AMENITY',
      });
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'p1', attributes: {} });
      prisma.productContentImportField.update.mockResolvedValue({});
      prisma.productContentImportField.count.mockResolvedValue(2);

      await service.reviewField('imp-1', 'f1', { decision: 'APPROVED' }, 'actor-1');

      expect(prisma.productContentImport.update).toHaveBeenCalledWith({
        where: { id: 'imp-1' },
        data: { status: 'REVIEW_IN_PROGRESS' },
      });
    });
  });

  describe('bezbednosna provera — polje mora pripadati navedenom uvozu', () => {
    it('baca grešku kad field.import.id !== importId iz URL-a', async () => {
      const { service, prisma } = makeService();
      prisma.productContentImportField.findUniqueOrThrow.mockResolvedValue({
        id: 'f1',
        import: { id: 'drugi-uvoz', productId: 'p1' },
        extractedValue: {},
        fieldType: 'AMENITY',
      });

      await expect(service.reviewField('imp-1', 'f1', { decision: 'REJECTED' }, 'actor-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
