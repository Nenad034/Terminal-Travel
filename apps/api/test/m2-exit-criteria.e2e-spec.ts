import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SYSTEM_ROLES } from '../src/modules/m1-core-identitet/roles/system-roles.constants';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';

/**
 * E2E protiv prave Postgres baze — pokriva stavke M2 izlaznog kriterijuma
 * (docs/moduli/M02-katalog-proizvoda/03-SPECIFIKACIJA-M2-KATALOG-PROIZVODA.md poglavlje 8)
 * koje ne zavise od M3/M4/M5/M23 (ti delovi eksplicitno čekaju te module, vidi spec).
 *
 * Auth se namerno preskače (JWT potpisan direktno istim JWT_SECRET) — M2 testovi ne
 * ponavljaju M1 login/2FA tok (vidi test/m1-exit-criteria.e2e-spec.ts), samo proveravaju
 * da PermissionsGuard ispravno gejtuje M2 rute.
 */
describe('M2 — izlazni kriterijum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const testRunId = Date.now();
  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    if (createdProductIds.length) {
      await prisma.productContentImportField.deleteMany({
        where: { import: { productId: { in: createdProductIds } } },
      });
      await prisma.productContentImport.deleteMany({ where: { productId: { in: createdProductIds } } });
      await prisma.productTranslation.deleteMany({ where: { productId: { in: createdProductIds } } });
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    }
    if (createdUserIds.length) {
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  async function createInternalUser(roleName: string) {
    const user = await prisma.user.create({
      data: {
        email: `m2-${roleName.toLowerCase()}-${testRunId}-${Math.random().toString(36).slice(2)}@tt-test.rs`,
        fullName: 'M2 Test Korisnik',
        accountType: 'STAFF',
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(user.id);
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, assignedBy: user.id } });
    const accessToken = jwt.sign({ sub: user.id, sessionId: 'e2e-test-session' });
    return { user, accessToken };
  }

  function authed(accessToken: string) {
    return { Authorization: `Bearer ${accessToken}` };
  }

  describe('CRUD + objava + prevodi (izlazni kriterijum, stavka 1)', () => {
    it('kreira CONTRACTED proizvod, dodaje sr+en prevode, objavljuje ga, i nalazi ga kroz /products filtriran po kanalu', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/catalog/products')
        .set(authed(accessToken))
        .send({ type: 'ACCOMMODATION', destinationCountry: 'Srbija', destinationCity: 'Zlatibor' });
      expect(createRes.status).toBe(201);
      const productId = createRes.body.id;
      createdProductIds.push(productId);
      expect(createRes.body.sourceType).toBe('CONTRACTED');
      expect(createRes.body.status).toBe('DRAFT');

      await request(app.getHttpServer())
        .put(`/api/v1/catalog/products/${productId}/translations`)
        .set(authed(accessToken))
        .send({ languageCode: 'sr', name: 'Hotel Zlatibor', description: 'Opis', slug: `hotel-zlatibor-${testRunId}` })
        .expect(200);
      await request(app.getHttpServer())
        .put(`/api/v1/catalog/products/${productId}/translations`)
        .set(authed(accessToken))
        .send({ languageCode: 'en', name: 'Zlatibor Hotel', description: 'Description', slug: `zlatibor-hotel-${testRunId}` })
        .expect(200);

      const publishRes = await request(app.getHttpServer())
        .post(`/api/v1/catalog/products/${productId}/publish`)
        .set(authed(accessToken))
        .send({ visibleChannels: ['B2C_SITE'] });
      expect(publishRes.status).toBe(201);
      expect(publishRes.body.status).toBe('ACTIVE');

      const listRes = await request(app.getHttpServer())
        .get('/api/v1/catalog/products')
        .query({ channel: 'B2C_SITE' })
        .set(authed(accessToken));
      expect(listRes.status).toBe(200);
      expect(listRes.body.some((p: { id: string }) => p.id === productId)).toBe(true);
    });

    it('odbija objavu (DRAFT → ACTIVE) bez srpskog i engleskog prevoda', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/catalog/products')
        .set(authed(accessToken))
        .send({ type: 'ACCOMMODATION', destinationCountry: 'Srbija', destinationCity: 'Vrnjačka Banja' });
      const productId = createRes.body.id;
      createdProductIds.push(productId);

      const publishRes = await request(app.getHttpServer())
        .post(`/api/v1/catalog/products/${productId}/publish`)
        .set(authed(accessToken))
        .send({});
      expect(publishRes.status).toBe(400);
    });
  });

  describe('Fallback jezika (izlazni kriterijum, stavka 4)', () => {
    it('traženi jezik → engleski → srpski', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/catalog/products')
        .set(authed(accessToken))
        .send({ type: 'ACCOMMODATION', destinationCountry: 'Srbija', destinationCity: 'Niš' });
      const productId = createRes.body.id;
      createdProductIds.push(productId);

      await request(app.getHttpServer())
        .put(`/api/v1/catalog/products/${productId}/translations`)
        .set(authed(accessToken))
        .send({ languageCode: 'sr', name: 'Srpski naziv', description: 'Opis', slug: `nis-${testRunId}` });
      await request(app.getHttpServer())
        .put(`/api/v1/catalog/products/${productId}/translations`)
        .set(authed(accessToken))
        .send({ languageCode: 'en', name: 'English name', description: 'Desc', slug: `nis-en-${testRunId}` });

      const frRes = await request(app.getHttpServer())
        .get(`/api/v1/catalog/products/${productId}`)
        .query({ lang: 'fr' })
        .set(authed(accessToken));
      expect(frRes.body.translation.name).toBe('English name'); // fr nema → pada na en
    });
  });

  describe('Sakrivanje identiteta dobavljača od javnog kanala (izlazni kriterijum, stavka 6)', () => {
    it('interni odgovor (M17) sadrži source_*; javni odgovor (M7/M8/M9) ih ne sadrži nikako u payload-u', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/catalog/products')
        .set(authed(accessToken))
        .send({ type: 'ACCOMMODATION', destinationCountry: 'Srbija', destinationCity: 'Kopaonik' });
      const productId = createRes.body.id;
      createdProductIds.push(productId);
      await request(app.getHttpServer())
        .put(`/api/v1/catalog/products/${productId}/translations`)
        .set(authed(accessToken))
        .send({ languageCode: 'sr', name: 'Sr', description: 'Opis', slug: `kop-sr-${testRunId}` });
      await request(app.getHttpServer())
        .put(`/api/v1/catalog/products/${productId}/translations`)
        .set(authed(accessToken))
        .send({ languageCode: 'en', name: 'En', description: 'Desc', slug: `kop-en-${testRunId}` });
      await request(app.getHttpServer())
        .post(`/api/v1/catalog/products/${productId}/publish`)
        .set(authed(accessToken))
        .send({ visibleChannels: ['B2C_SITE'] });

      const internalRes = await request(app.getHttpServer())
        .get(`/api/v1/catalog/products/${productId}`)
        .set(authed(accessToken));
      expect(internalRes.body).toHaveProperty('sourceType');

      const publicRes = await request(app.getHttpServer())
        .get(`/api/v1/catalog/public/products/${productId}`)
        .query({ channel: 'B2C_SITE' });
      expect(publicRes.status).toBe(200);
      expect(publicRes.body).not.toHaveProperty('sourceType');
      expect(publicRes.body).not.toHaveProperty('sourceContractId');
      expect(publicRes.body).not.toHaveProperty('sourceProvider');
      expect(publicRes.body).not.toHaveProperty('sourceExternalId');
      // Ne blanket regex na "source" — ProductTranslation.translationSource je legitimno polje
      // (poreklo prevoda: MANUAL/AI_GENERATED), nema veze sa identitetom dobavljača (§5.1).
      expect(JSON.stringify(publicRes.body)).not.toMatch(/"sourceType"|"sourceContractId"|"sourceProvider"|"sourceExternalId"/);
    });

    it('javni endpoint ne vraća proizvod koji nije ACTIVE ili nije vidljiv na traženom kanalu', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/catalog/products')
        .set(authed(accessToken))
        .send({ type: 'ACCOMMODATION', destinationCountry: 'Srbija', destinationCity: 'Tara' });
      const productId = createRes.body.id;
      createdProductIds.push(productId);

      const publicRes = await request(app.getHttpServer())
        .get(`/api/v1/catalog/public/products/${productId}`)
        .query({ channel: 'B2C_SITE' });
      expect(publicRes.status).toBe(404);
    });

    // Dopuna 3.9.2026 — do tada su oba slučaja vraćala `500 Internal server error`:
    // `channel` je bio samo otkucan kao `VisibleChannel`, bez provere u vreme izvršavanja,
    // pa je `undefined` išao pravo u Prisma upit. Ovo je JEDINI endpoint bez autentikacije,
    // dakle jedini gde poruka o grešci objašnjava spoljnom integratoru šta je pogrešio.
    // Vidi zamku 13.1 i stavku izlaznog kriterijuma M2.
    it('javni endpoint vraća 400 sa objašnjenjem kad channel nedostaje ili nije važeći', async () => {
      const bezKanala = await request(app.getHttpServer()).get('/api/v1/catalog/public/products');
      expect(bezKanala.status).toBe(400);
      expect(bezKanala.body.message).toContain('channel');

      const pogresanKanal = await request(app.getHttpServer())
        .get('/api/v1/catalog/public/products')
        .query({ channel: 'IZMISLJEN' });
      expect(pogresanKanal.status).toBe(400);
      expect(pogresanKanal.body.message).toContain('B2C_SITE');

      // Ista ograda mora stajati i na ruti za jedan proizvod, ne samo na listi.
      const jedanBezKanala = await request(app.getHttpServer()).get(
        '/api/v1/catalog/public/products/00000000-0000-0000-0000-000000000000',
      );
      expect(jedanBezKanala.status).toBe(400);
    });

    it('javni endpoint prihvata izostavljen lang, a odbija nepodržan', async () => {
      const bezJezika = await request(app.getHttpServer())
        .get('/api/v1/catalog/public/products')
        .query({ channel: 'B2C_SITE' });
      expect(bezJezika.status).toBe(200);

      const pogresanJezik = await request(app.getHttpServer())
        .get('/api/v1/catalog/public/products')
        .query({ channel: 'B2C_SITE', lang: 'zz' });
      expect(pogresanJezik.status).toBe(400);
      expect(pogresanJezik.body.message).toContain('lang');
    });
  });

  describe('Novi tipovi proizvoda TRANSPORT/TICKET/EVENT (izlazni kriterijum, stavka 7)', () => {
    it.each(['TRANSPORT', 'TICKET', 'EVENT'])('kreira %s proizvod i nalazi ga filtriran po tipu', async (type) => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/catalog/products')
        .set(authed(accessToken))
        .send({ type, destinationCountry: 'Srbija', destinationCity: 'Beograd' });
      expect(createRes.status).toBe(201);
      createdProductIds.push(createRes.body.id);

      const listRes = await request(app.getHttpServer())
        .get('/api/v1/catalog/products')
        .query({ type })
        .set(authed(accessToken));
      expect(listRes.body.every((p: { type: string }) => p.type === type)).toBe(true);
      expect(listRes.body.some((p: { id: string }) => p.id === createRes.body.id)).toBe(true);
    });
  });

  describe('room_types[] strukturirani objekti + podrazumevan age_policy (izlazni kriterijum, stavke 8-9)', () => {
    it('room_types[] bez age_policy vraća podrazumevani niz; media[] sa category=ROOM referencira room_type_code', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/catalog/products')
        .set(authed(accessToken))
        .send({ type: 'ACCOMMODATION', destinationCountry: 'Srbija', destinationCity: 'Zlatibor' });
      const productId = createRes.body.id;
      createdProductIds.push(productId);

      await request(app.getHttpServer())
        .patch(`/api/v1/catalog/products/${productId}`)
        .set(authed(accessToken))
        .send({
          attributes: {
            room_types: [
              { code: 'DELUXE', name: 'Deluxe soba', capacity_adults: 2, capacity_children: 1 },
              {
                code: 'STANDARD',
                name: 'Standardna soba',
                capacity_adults: 2,
                capacity_children: 0,
                age_policy: [{ category: 'ADULT', age_from: 16, age_to: null, counts_toward_capacity: true }],
              },
            ],
          },
          media: [{ url: 'https://example.com/soba.jpg', type: 'image', order: 0, category: 'ROOM', room_type_code: 'DELUXE' }],
        })
        .expect(200);

      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/catalog/products/${productId}`)
        .set(authed(accessToken));

      const roomTypes = getRes.body.attributes.room_types;
      expect(roomTypes[0].age_policy).toHaveLength(3); // podrazumevani (ADULT/CHILD/INFANT)
      expect(roomTypes[1].age_policy).toHaveLength(1); // eksplicitno postavljen, nepromenjen
      expect(getRes.body.media[0].room_type_code).toBe('DELUXE');
    });
  });

  describe('ProductContentImport — M23_RESEARCH i ljudski tok odobrenja (izlazni kriterijum, stavke 12-14)', () => {
    it('M23_RESEARCH ulazi direktno u EXTRACTED sa source_article_revision_id, i primenjuje se tek posle reviewedBy', async () => {
      const { accessToken, user: owner } = await createInternalUser(SYSTEM_ROLES.VLASNIK);
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/catalog/products')
        .set(authed(accessToken))
        .send({ type: 'ACCOMMODATION', destinationCountry: 'Srbija', destinationCity: 'Palić' });
      const productId = createRes.body.id;
      createdProductIds.push(productId);

      const importRes = await request(app.getHttpServer())
        .post('/api/v1/catalog/product-content-imports')
        .set(authed(accessToken))
        .send({
          origin: 'M23_RESEARCH',
          productId,
          fields: [
            {
              fieldType: 'PHOTO',
              extractedValue: { url: 'https://hotel-palic.com/foto.jpg', category: 'EXTERIOR' },
              sourceArticleRevisionId: '11111111-1111-1111-1111-111111111111',
            },
          ],
        });
      expect(importRes.status).toBe(201);
      expect(importRes.body.status).toBe('EXTRACTED'); // preskače PENDING (§3.3a)
      const fieldId = importRes.body.fields[0].id;
      expect(importRes.body.fields[0].sourceArticleRevisionId).toBe('11111111-1111-1111-1111-111111111111');
      expect(importRes.body.fields[0].reviewedBy).toBeNull(); // ništa nije primenjeno pre ljudskog pregleda

      // pre odobrenja, media[] proizvoda je i dalje prazan
      const beforeReview = await request(app.getHttpServer())
        .get(`/api/v1/catalog/products/${productId}`)
        .set(authed(accessToken));
      expect(beforeReview.body.media).toEqual([]);

      const reviewRes = await request(app.getHttpServer())
        .post(`/api/v1/catalog/product-content-imports/${importRes.body.id}/fields/${fieldId}/review`)
        .set(authed(accessToken))
        .send({ decision: 'APPROVED' });
      expect(reviewRes.status).toBe(201);
      expect(reviewRes.body.reviewedBy).toBe(owner.id);
      expect(reviewRes.body.appliedAt).not.toBeNull();

      const afterReview = await request(app.getHttpServer())
        .get(`/api/v1/catalog/products/${productId}`)
        .set(authed(accessToken));
      expect(afterReview.body.media[0]).toMatchObject({
        url: 'https://hotel-palic.com/foto.jpg',
        source: 'AI_IMPORTED',
        category: 'EXTERIOR',
      });

      const importCompletedRes = await request(app.getHttpServer())
        .get(`/api/v1/catalog/product-content-imports/${importRes.body.id}`)
        .set(authed(accessToken));
      expect(importCompletedRes.body.status).toBe('COMPLETED');
    });
  });

  describe('Dozvole — Sales Manager sme samo VIEW, ne CREATE (M2 spec §6)', () => {
    it('Sales Manager dobija 403 na POST /products', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.SALES_MANAGER);

      const res = await request(app.getHttpServer())
        .post('/api/v1/catalog/products')
        .set(authed(accessToken))
        .send({ type: 'ACCOMMODATION', destinationCountry: 'Srbija', destinationCity: 'Beograd' });

      expect(res.status).toBe(403);
    });

    it('Sales Manager sme GET /products', async () => {
      const { accessToken } = await createInternalUser(SYSTEM_ROLES.SALES_MANAGER);

      const res = await request(app.getHttpServer()).get('/api/v1/catalog/products').set(authed(accessToken));

      expect(res.status).toBe(200);
    });
  });
});
