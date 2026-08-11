import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { encryptSecret } from '../src/common/crypto/secret-box';
import { SYSTEM_ROLES } from '../src/modules/m1-core-identitet/roles/system-roles.constants';

/**
 * E2E protiv prave Postgres baze (docker-compose, port 5435) — pokriva stavke
 * M1 izlaznog kriterijuma (docs/moduli/M01-core-identitet/02-SPECIFIKACIJA-M1-CORE-IDENTITET.md
 * poglavlje 8) koje se ne mogu proveriti mokovanjem Prisma-e u unit testovima:
 * append-only trigger na nivou baze, stvarno seedovane sistemske uloge, i pun
 * HTTP tok (login → 2FA → RBAC override sa trenutnim efektom bez ponovne prijave).
 *
 * Pretpostavlja da je pre pokretanja urađeno (vidi apps/api/README.md):
 *   docker compose up -d postgres && npx prisma migrate deploy &&
 *   psql < prisma/sql/audit_log_append_only.sql && npx prisma db seed
 */
describe('M1 — izlazni kriterijum (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const testRunId = Date.now();
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Audit log je namerno append-only (ne može se obrisati) — testni zapisi ostaju,
    // isti tretman kao bilo koji drugi produkcijski trag. Brišemo samo testne korisnike.
    if (createdUserIds.length) {
      await prisma.userPermissionOverride.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  async function createUser(opts: {
    email: string;
    roleName?: string;
    mfaEnabled?: boolean;
    mfaSecret?: string;
    failedLoginAttempts?: number;
    lockedUntil?: Date | null;
  }) {
    const passwordHash = await argon2.hash('ispravna-lozinka-123', { type: argon2.argon2id });
    const user = await prisma.user.create({
      data: {
        email: opts.email,
        passwordHash,
        fullName: 'Test Korisnik',
        accountType: 'STAFF',
        status: 'ACTIVE',
        mfaEnabled: opts.mfaEnabled ?? false,
        mfaSecretEncrypted: opts.mfaSecret ? encryptSecret(opts.mfaSecret) : null,
        failedLoginAttempts: opts.failedLoginAttempts ?? 0,
        lockedUntil: opts.lockedUntil ?? null,
      },
    });
    createdUserIds.push(user.id);

    if (opts.roleName) {
      const role = await prisma.role.findUniqueOrThrow({ where: { name: opts.roleName } });
      await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, assignedBy: user.id } });
    }
    return user;
  }

  describe('Sedam sistemskih uloga postoje u bazi (izlazni kriterijum, stavka 2)', () => {
    it('sve uloge iz M1 spec §4 (osnovnih sedam) postoje kao is_system_role=true', async () => {
      const names = Object.values(SYSTEM_ROLES);
      const roles = await prisma.role.findMany({ where: { name: { in: names } } });

      expect(roles).toHaveLength(names.length);
      expect(roles.every((r) => r.isSystemRole)).toBe(true);
    });
  });

  describe('Audit log je append-only na nivou baze (izlazni kriterijum, stavka 4)', () => {
    it('UPDATE nad audit_log_entries je fizički odbijen trigerom', async () => {
      const entry = await prisma.auditLogEntry.create({
        data: {
          actorType: 'SYSTEM',
          module: 'TEST',
          action: 'e2e.append_only_check',
          resourceType: 'Test',
          resourceId: `test-${testRunId}`,
          context: {},
        },
      });

      await expect(
        prisma.$executeRawUnsafe(`UPDATE audit_log_entries SET action = 'izmenjeno' WHERE id = '${entry.id}'`),
      ).rejects.toThrow(/append-only/);
    });

    it('DELETE nad audit_log_entries je fizički odbijen trigerom', async () => {
      const entry = await prisma.auditLogEntry.create({
        data: {
          actorType: 'SYSTEM',
          module: 'TEST',
          action: 'e2e.append_only_check_delete',
          resourceType: 'Test',
          resourceId: `test-${testRunId}`,
          context: {},
        },
      });

      await expect(
        prisma.$executeRawUnsafe(`DELETE FROM audit_log_entries WHERE id = '${entry.id}'`),
      ).rejects.toThrow(/append-only/);
    });
  });

  describe('Prijava, obavezna 2FA za interne uloge, zaključavanje (izlazni kriterijum, stavke 1 i 5)', () => {
    it('interna uloga (VLASNIK) bez podešene 2FA ne može da se prijavi', async () => {
      const user = await createUser({ email: `vlasnik-${testRunId}@tt-test.rs`, roleName: SYSTEM_ROLES.VLASNIK });

      const res = await request(app.getHttpServer())
        .post('/api/v1/iam/auth/login')
        .send({ email: user.email, password: 'ispravna-lozinka-123' });

      expect(res.status).toBe(403);
    });

    it('Gost bez 2FA sme da se prijavi (2FA opciona za Gosta)', async () => {
      const user = await createUser({ email: `gost-${testRunId}@tt-test.rs`, roleName: SYSTEM_ROLES.GOST });

      const res = await request(app.getHttpServer())
        .post('/api/v1/iam/auth/login')
        .send({ email: user.email, password: 'ispravna-lozinka-123' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('interna uloga sa podešenom 2FA prolazi kroz pun login → mfa/verify tok', async () => {
      const secret = authenticator.generateSecret();
      const user = await createUser({
        email: `vlasnik-mfa-${testRunId}@tt-test.rs`,
        roleName: SYSTEM_ROLES.VLASNIK,
        mfaEnabled: true,
        mfaSecret: secret,
      });

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/iam/auth/login')
        .send({ email: user.email, password: 'ispravna-lozinka-123' });

      expect(loginRes.status).toBe(201);
      expect(loginRes.body).toEqual({ requiresMfa: true, mfaToken: expect.any(String) });

      const validCode = authenticator.generate(secret);
      const mfaRes = await request(app.getHttpServer())
        .post('/api/v1/iam/auth/mfa/verify')
        .send({ mfaToken: loginRes.body.mfaToken, code: validCode });

      expect(mfaRes.status).toBe(201);
      expect(mfaRes.body).toHaveProperty('accessToken');
    });

    it('posle 5 uzastopnih pogrešnih lozinki nalog se zaključava i ispravna lozinka i dalje ne prolazi (M1 spec §5)', async () => {
      const user = await createUser({ email: `lockout-${testRunId}@tt-test.rs`, roleName: SYSTEM_ROLES.GOST });

      for (let i = 0; i < 5; i++) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/iam/auth/login')
          .send({ email: user.email, password: 'pogresna-lozinka-xx' });
        expect(res.status).toBe(401);
      }

      const afterLockout = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(afterLockout.lockedUntil).not.toBeNull();
      expect(afterLockout.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

      const correctPasswordAttempt = await request(app.getHttpServer())
        .post('/api/v1/iam/auth/login')
        .send({ email: user.email, password: 'ispravna-lozinka-123' });
      expect(correctPasswordAttempt.status).toBe(403);
    });
  });

  describe('UserPermissionOverride ima trenutni efekat bez ponovne prijave (izlazni kriterijum, stavka 3)', () => {
    it('override dodat posle izdavanja access tokena odmah utiče na sledeći zahtev istim tokenom', async () => {
      const user = await createUser({ email: `override-${testRunId}@tt-test.rs`, roleName: SYSTEM_ROLES.GOST });
      const owner = await createUser({ email: `owner-${testRunId}@tt-test.rs`, roleName: SYSTEM_ROLES.VLASNIK });

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/iam/auth/login')
        .send({ email: user.email, password: 'ispravna-lozinka-123' });
      const accessToken = loginRes.body.accessToken;

      // Gost nema M1/user/VIEW — pristup listi korisnika mora biti odbijen.
      const beforeOverride = await request(app.getHttpServer())
        .get('/api/v1/iam/users')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(beforeOverride.status).toBe(403);

      const permission = await prisma.permission.findUniqueOrThrow({
        where: { module_resource_action: { module: 'M1', resource: 'user', action: 'VIEW' } },
      });
      await prisma.userPermissionOverride.create({
        data: {
          userId: user.id,
          permissionId: permission.id,
          effect: 'ALLOW',
          reason: 'e2e test — provera trenutnog efekta override-a',
          grantedBy: owner.id,
        },
      });

      // Isti (nepromenjen, ponovo neizdat) access token — bez ikakve nove prijave.
      const afterOverride = await request(app.getHttpServer())
        .get('/api/v1/iam/users')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(afterOverride.status).toBe(200);
    });
  });

  describe('Svaka izmena ostavlja trag u audit logu (izlazni kriterijum, stavka 4)', () => {
    it('uspešna prijava upisuje AuditLogEntry sa actorId korisnika', async () => {
      const user = await createUser({ email: `audit-${testRunId}@tt-test.rs`, roleName: SYSTEM_ROLES.GOST });

      await request(app.getHttpServer())
        .post('/api/v1/iam/auth/login')
        .send({ email: user.email, password: 'ispravna-lozinka-123' });

      const entry = await prisma.auditLogEntry.findFirst({
        where: { action: 'auth.login_success', actorId: user.id },
      });
      expect(entry).not.toBeNull();
      expect(entry?.module).toBe('M1');
    });
  });
});
