import { BadRequestException, NotImplementedException } from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  function makeService() {
    const prisma = {
      // `count` + `$transaction` (5.9.2026) — `findAll` je od uvođenja straničenja (dok. 39
      // nalaz 2.2) jedan `$transaction` sa dva upita, da broj i redovi dođu iz istog trenutka.
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
      product: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findFirstOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      productTranslation: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };
    const auditLog = { write: jest.fn() };
    const eventBus = { emit: jest.fn() };
    const service = new ProductsService(prisma as any, auditLog as any, eventBus as any);
    return { service, prisma, auditLog, eventBus };
  }

  describe('create (M2 spec §7 — ručno kreiranje CONTRACTED proizvoda)', () => {
    it('uvek postavlja sourceType=CONTRACTED, status=DRAFT, cacheStatus=N_A, i upisuje audit log', async () => {
      const { service, prisma, auditLog } = makeService();
      const created = { id: 'p1', type: 'ACCOMMODATION', sourceType: 'CONTRACTED' };
      prisma.product.create.mockResolvedValue(created);

      const result = await service.create(
        { type: 'ACCOMMODATION' as any, destinationCountry: 'Srbija', destinationCity: 'Beograd' },
        'actor-1',
      );

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sourceType: 'CONTRACTED', status: 'DRAFT', cacheStatus: 'N_A', createdBy: 'actor-1' }),
        }),
      );
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'product.created', module: 'M2' }));
      expect(result).toBe(created);
    });
  });

  describe('archive (DELETE = meko gašenje, M2 spec §7)', () => {
    it('menja status na ARCHIVED, ne briše zapis, upisuje audit log', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'p1', status: 'ACTIVE' });
      prisma.product.update.mockResolvedValue({ id: 'p1', status: 'ARCHIVED' });

      const result = await service.archive('p1', 'actor-1');

      expect(prisma.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { status: 'ARCHIVED' } });
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'product.archived' }));
      expect(result.status).toBe('ARCHIVED');
    });
  });

  describe('upsertTranslation', () => {
    it('upisuje audit log i podrazumeva translationSource=MANUAL, isReviewed=true za ručan unos', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.productTranslation.upsert.mockResolvedValue({ id: 't1', languageCode: 'sr' });

      await service.upsertTranslation(
        'p1',
        { languageCode: 'sr' as any, name: 'Naziv', description: 'Opis', slug: 'naziv' },
        'actor-1',
      );

      const call = prisma.productTranslation.upsert.mock.calls[0][0];
      expect(call.create.translationSource).toBe('MANUAL');
      expect(call.create.isReviewed).toBe(true);
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'product_translation.upserted' }));
    });
  });

  describe('publish (M2 spec §2.2 — sr+en obavezni pre DRAFT → ACTIVE; §4.1 — event na ulasku u ACTIVE)', () => {
    it('odbija prelaz DRAFT → ACTIVE bez srpskog i engleskog prevoda', async () => {
      const { service, prisma } = makeService();
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'p1', status: 'DRAFT' });
      prisma.productTranslation.findMany.mockResolvedValue([{ languageCode: 'sr' }]); // nema en

      await expect(service.publish('p1', {}, 'actor-1')).rejects.toThrow(BadRequestException);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('uspešan prelaz DRAFT → ACTIVE sa sr+en emituje product.published na Event Bus', async () => {
      const { service, prisma, eventBus, auditLog } = makeService();
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'p1', status: 'DRAFT', visibleChannels: [] });
      prisma.productTranslation.findMany.mockResolvedValue([{ languageCode: 'sr' }, { languageCode: 'en' }]);
      prisma.product.update.mockResolvedValue({ id: 'p1', status: 'ACTIVE', visibleChannels: ['B2C_SITE'] });

      const result = await service.publish('p1', { visibleChannels: ['B2C_SITE'] as any }, 'actor-1');

      expect(eventBus.emit).toHaveBeenCalledWith('M2', 'product.published', { productId: 'p1' });
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'product.published' }));
      expect(result.status).toBe('ACTIVE');
    });

    it('kad je proizvod već ACTIVE, samo menja visible_channels bez ponovnog event emitovanja', async () => {
      const { service, prisma, eventBus } = makeService();
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'p1', status: 'ACTIVE', visibleChannels: ['B2C_SITE'] });
      prisma.product.update.mockResolvedValue({ id: 'p1', status: 'ACTIVE', visibleChannels: ['B2B_PORTAL'] });

      await service.publish('p1', { visibleChannels: ['B2B_PORTAL'] as any }, 'actor-1');

      expect(eventBus.emit).not.toHaveBeenCalled();
      // gate za sr/en se ne proverava ponovo kad proizvod već jeste ACTIVE
      expect(prisma.productTranslation.findMany).not.toHaveBeenCalled();
    });
  });

  describe('syncCache (M2 spec §3.1/§3.2 — CONTRACTED nema keš; API-sourced čeka M4)', () => {
    it('CONTRACTED proizvod baca BadRequestException (nema pojam keširanja)', async () => {
      const { service, prisma } = makeService();
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'p1', sourceType: 'CONTRACTED' });

      await expect(service.syncCache('p1')).rejects.toThrow(BadRequestException);
    });

    it('API-sourced proizvod baca NotImplementedException (M4 još ne postoji)', async () => {
      const { service, prisma } = makeService();
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'p1', sourceType: 'API' });

      await expect(service.syncCache('p1')).rejects.toThrow(NotImplementedException);
    });
  });

  describe('findAll / findOne — jezički fallback i podrazumevan age_policy (M2 spec §2.2/§2.3b)', () => {
    it('findAll rešava prevod po traženom jeziku sa fallback-om i popunjava age_policy', async () => {
      const { service, prisma } = makeService();
      prisma.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          attributes: { room_types: [{ code: 'STD' }] },
          translations: [{ languageCode: 'sr', name: 'Srpski' }, { languageCode: 'en', name: 'English' }],
        },
      ]);

      const result = await service.findAll({ lang: 'fr' as any });

      expect(result.data[0].translation?.name).toBe('English'); // fallback fr → en
      expect((result.data[0].attributes as any).room_types[0].age_policy).toHaveLength(3);
    });

    it('findAll koristi srpski kao podrazumevan jezik kad lang nije prosleđen', async () => {
      const { service, prisma } = makeService();
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', attributes: {}, translations: [{ languageCode: 'sr', name: 'Srpski' }] },
      ]);

      const result = await service.findAll({});
      expect(result.data[0].translation?.name).toBe('Srpski');
    });
  });

  describe('findAllPublic / findOnePublic (M2 spec §5.1 — javni kanal, bez source_* polja)', () => {
    it('filtrira po status=ACTIVE i traženom kanalu, i uklanja source_* polja', async () => {
      const { service, prisma } = makeService();
      prisma.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          sourceType: 'CONTRACTED',
          sourceContractId: 'c1',
          sourceProvider: null,
          sourceExternalId: null,
          attributes: {},
          translations: [{ languageCode: 'sr', name: 'Srpski' }],
        },
      ]);

      const result = await service.findAllPublic('B2C_SITE' as any);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'ACTIVE', visibleChannels: { has: 'B2C_SITE' } } }),
      );
      expect(result[0]).not.toHaveProperty('sourceContractId');
      expect(result[0]).not.toHaveProperty('sourceType');
    });

    it('findOnePublic baca grešku kad proizvod nije ACTIVE ili nije vidljiv na kanalu (findFirstOrThrow)', async () => {
      const { service, prisma } = makeService();
      prisma.product.findFirstOrThrow.mockRejectedValue(new Error('Not found'));

      await expect(service.findOnePublic('p1', 'B2C_SITE' as any)).rejects.toThrow();
      expect(prisma.product.findFirstOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p1', status: 'ACTIVE', visibleChannels: { has: 'B2C_SITE' } } }),
      );
    });
  });
});
