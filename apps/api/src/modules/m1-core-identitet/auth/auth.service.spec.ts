import { ForbiddenException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { AuthService } from './auth.service';
import { encryptSecret } from '../../../common/crypto/secret-box';

// M1 spec §5 (autentikacija/2FA/zaključavanje) i §3.7 (sesije/refresh token rotacija).
describe('AuthService', () => {
  const jwt = new JwtService({ secret: 'test-jwt-secret-for-unit-tests' });

  function makePrismaMock() {
    return {
      user: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn(),
      },
      userRole: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
      },
      passwordResetToken: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      mfaRecoveryCode: {
        createMany: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };
  }

  function makeService() {
    const prisma = makePrismaMock();
    const auditLog = { write: jest.fn().mockResolvedValue({}) };
    const service = new AuthService(prisma as any, jwt, auditLog as any);
    return { service, prisma, auditLog };
  }

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-not-for-production';
  });

  describe('login', () => {
    it('baca UnauthorizedException kad korisnik ne postoji', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login('nepostojeci@tt.rs', 'lozinka123456', null)).rejects.toThrow(UnauthorizedException);
    });

    it('baca ForbiddenException kad je nalog trenutno zaključan', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        lockedUntil: new Date(Date.now() + 60_000),
        passwordHash: 'x',
      });

      await expect(service.login('user@tt.rs', 'lozinka123456', null)).rejects.toThrow(ForbiddenException);
    });

    it('baca ForbiddenException kad nalog čeka aktivaciju (nema password_hash)', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', lockedUntil: null, passwordHash: null });

      await expect(service.login('user@tt.rs', 'lozinka123456', null)).rejects.toThrow(ForbiddenException);
    });

    it('pogrešna lozinka: povećava brojač neuspešnih pokušaja i piše audit log, ne zaključava pre praga', async () => {
      const { service, prisma, auditLog } = makeService();
      const passwordHash = await argon2.hash('ispravna-lozinka-12', { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        lockedUntil: null,
        passwordHash,
        failedLoginAttempts: 2,
        status: 'ACTIVE',
      });

      await expect(service.login('user@tt.rs', 'pogresna-lozinka', null)).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { failedLoginAttempts: 3, lockedUntil: null },
      });
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login_failed' }));
    });

    it('peti uzastopni neuspeh zaključava nalog na 15 minuta i piše audit log "user.locked" (M1 spec §5)', async () => {
      const { service, prisma, auditLog } = makeService();
      const passwordHash = await argon2.hash('ispravna-lozinka-12', { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        lockedUntil: null,
        passwordHash,
        failedLoginAttempts: 4, // ovo je peti pokušaj
        status: 'ACTIVE',
      });

      await expect(service.login('user@tt.rs', 'pogresna-lozinka', '1.2.3.4')).rejects.toThrow(UnauthorizedException);

      const updateCall = prisma.user.update.mock.calls[0][0];
      expect(updateCall.data.failedLoginAttempts).toBe(0);
      expect(updateCall.data.lockedUntil).toBeInstanceOf(Date);
      expect(updateCall.data.lockedUntil.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
      expect(updateCall.data.lockedUntil.getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60_000);

      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.locked', ipAddress: '1.2.3.4' }),
      );
    });

    it('baca ForbiddenException kad nalog nije ACTIVE (npr. SUSPENDED) i posle ispravne lozinke', async () => {
      const { service, prisma } = makeService();
      const passwordHash = await argon2.hash('ispravna-lozinka-12', { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        lockedUntil: null,
        passwordHash,
        failedLoginAttempts: 0,
        status: 'SUSPENDED',
      });

      await expect(service.login('user@tt.rs', 'ispravna-lozinka-12', null)).rejects.toThrow(ForbiddenException);
    });

    it('interna uloga bez podešene 2FA ne sme proći login (M1 spec §5 — "ne može proći bez uspešno podešene 2FA")', async () => {
      const { service, prisma } = makeService();
      const passwordHash = await argon2.hash('ispravna-lozinka-12', { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        lockedUntil: null,
        passwordHash,
        failedLoginAttempts: 0,
        status: 'ACTIVE',
        mfaEnabled: false,
      });
      prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'VLASNIK' } }]);

      await expect(service.login('vlasnik@tt.rs', 'ispravna-lozinka-12', null)).rejects.toThrow(ForbiddenException);
    });

    it('Gost bez 2FA sme da se prijavi (2FA je opciona za Gosta, M1 spec §5)', async () => {
      const { service, prisma } = makeService();
      const passwordHash = await argon2.hash('ispravna-lozinka-12', { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        lockedUntil: null,
        passwordHash,
        failedLoginAttempts: 0,
        status: 'ACTIVE',
        mfaEnabled: false,
      });
      prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'GOST' } }]);

      const result = await service.login('gost@tt.rs', 'ispravna-lozinka-12', null);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('kad je 2FA uključena, login vraća samo privremeni mfaToken, ne pravi tokeni (M1 spec §6)', async () => {
      const { service, prisma } = makeService();
      const passwordHash = await argon2.hash('ispravna-lozinka-12', { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        lockedUntil: null,
        passwordHash,
        failedLoginAttempts: 0,
        status: 'ACTIVE',
        mfaEnabled: true,
      });
      prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'VLASNIK' } }]);

      const result = await service.login('vlasnik@tt.rs', 'ispravna-lozinka-12', null);

      expect(result).toEqual({ requiresMfa: true, mfaToken: expect.any(String) });
    });

    it('uspešna prijava resetuje brojač neuspešnih pokušaja i piše audit log "auth.login_success"', async () => {
      const { service, prisma, auditLog } = makeService();
      const passwordHash = await argon2.hash('ispravna-lozinka-12', { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        lockedUntil: null,
        passwordHash,
        failedLoginAttempts: 3,
        status: 'ACTIVE',
        mfaEnabled: false,
      });
      prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'GOST' } }]);

      await service.login('gost@tt.rs', 'ispravna-lozinka-12', null);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login_success' }));
    });
  });

  describe('verifyMfa', () => {
    it('odbija nevažeći/istekao mfaToken', async () => {
      const { service } = makeService();
      await expect(service.verifyMfa('nije-pravi-jwt', '123456', null, null)).rejects.toThrow(UnauthorizedException);
    });

    it('odbija token koji nije tipa mfa_pending (npr. iznova poslat access token)', async () => {
      const { service } = makeService();
      const wrongTypeToken = jwt.sign({ sub: 'u1', type: 'access' });
      await expect(service.verifyMfa(wrongTypeToken, '123456', null, null)).rejects.toThrow(UnauthorizedException);
    });

    it('odbija kad korisnik nema podešen mfaSecretEncrypted', async () => {
      const { service, prisma } = makeService();
      const mfaToken = jwt.sign({ sub: 'u1', type: 'mfa_pending' });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', mfaSecretEncrypted: null });

      await expect(service.verifyMfa(mfaToken, '123456', null, null)).rejects.toThrow(ForbiddenException);
    });

    it('odbija pogrešan TOTP kod', async () => {
      const { service, prisma } = makeService();
      const secret = authenticator.generateSecret();
      const mfaToken = jwt.sign({ sub: 'u1', type: 'mfa_pending' });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', mfaSecretEncrypted: encryptSecret(secret) });

      await expect(service.verifyMfa(mfaToken, '000000', null, null)).rejects.toThrow(UnauthorizedException);
    });

    it('prihvata ispravan TOTP kod i izdaje access+refresh tokene', async () => {
      const { service, prisma } = makeService();
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);
      const mfaToken = jwt.sign({ sub: 'u1', type: 'mfa_pending' });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', mfaSecretEncrypted: encryptSecret(secret) });

      const result = await service.verifyMfa(mfaToken, validCode, '1.2.3.4', 'jest-agent');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('refresh (M1 spec §3.7 — rotira pri svakom korišćenju)', () => {
    it('odbija nepostojeći refresh token', async () => {
      const { service, prisma } = makeService();
      prisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.refresh('nepostojeci', null, null)).rejects.toThrow(UnauthorizedException);
    });

    it('odbija opozvan refresh token', async () => {
      const { service, prisma } = makeService();
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.refresh('opozvan', null, null)).rejects.toThrow(UnauthorizedException);
    });

    it('odbija istekao refresh token', async () => {
      const { service, prisma } = makeService();
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(service.refresh('istekao', null, null)).rejects.toThrow(UnauthorizedException);
    });

    it('validan refresh token: opoziva stari i izdaje novi par tokena (rotacija)', async () => {
      const { service, prisma } = makeService();
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.refresh('validan', null, null);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('logout', () => {
    it('ne baca grešku za nepostojeći token (tihi no-op)', async () => {
      const { service, prisma } = makeService();
      prisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.logout('nepostojeci', false)).resolves.toBeUndefined();
    });

    it('bez allDevices opoziva samo dati token', async () => {
      const { service, prisma } = makeService();
      prisma.refreshToken.findFirst.mockResolvedValue({ id: 'rt1', userId: 'u1' });

      await service.logout('token', false);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('sa allDevices=true opoziva sve aktivne refresh tokene korisnika', async () => {
      const { service, prisma } = makeService();
      prisma.refreshToken.findFirst.mockResolvedValue({ id: 'rt1', userId: 'u1' });

      await service.logout('token', true);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('requestPasswordReset (M1 spec §5)', () => {
    it('ne otkriva da li email postoji — nepostojeći email tiho vraća undefined bez kreiranja tokena', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.requestPasswordReset('nepostojeci@tt.rs');

      expect(result).toBeUndefined();
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('poznat email kreira token sa rokom od 1h i vraća sirov token pozivaocu', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });

      const rawToken = await service.requestPasswordReset('user@tt.rs');

      expect(rawToken).toEqual(expect.any(String));
      const createCall = prisma.passwordResetToken.create.mock.calls[0][0];
      expect(createCall.data.userId).toBe('u1');
      const expiresInMs = createCall.data.expiresAt.getTime() - Date.now();
      expect(expiresInMs).toBeGreaterThan(59 * 60_000);
      expect(expiresInMs).toBeLessThanOrEqual(60 * 60_000);
    });
  });

  describe('resetPassword', () => {
    it('odbija lozinku kraću od 12 karaktera pre bilo kakvog upita ka bazi', async () => {
      const { service, prisma } = makeService();

      await expect(service.resetPassword('token', 'kratka')).rejects.toThrow(BadRequestException);
      expect(prisma.passwordResetToken.findFirst).not.toHaveBeenCalled();
    });

    it('odbija nevažeći/nepostojeći token', async () => {
      const { service, prisma } = makeService();
      prisma.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword('token', 'nova-lozinka-12')).rejects.toThrow(BadRequestException);
    });

    it('odbija već iskorišćen token', async () => {
      const { service, prisma } = makeService();
      prisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'prt1',
        userId: 'u1',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.resetPassword('token', 'nova-lozinka-12')).rejects.toThrow(BadRequestException);
    });

    it('odbija istekao token', async () => {
      const { service, prisma } = makeService();
      prisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'prt1',
        userId: 'u1',
        usedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(service.resetPassword('token', 'nova-lozinka-12')).rejects.toThrow(BadRequestException);
    });

    it('validan token: menja lozinku, označava token kao iskorišćen, opoziva sve sesije, piše audit log', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'prt1',
        userId: 'u1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await service.resetPassword('token', 'nova-lozinka-12');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.password_reset' }));
    });
  });

  describe('activateAccount (M1 spec §5 — INVITED → ACTIVE)', () => {
    it('odbija kratku lozinku', async () => {
      const { service } = makeService();
      await expect(service.activateAccount('token', 'kratka')).rejects.toThrow(BadRequestException);
    });

    it('odbija nevažeći/istekao/iskorišćen link', async () => {
      const { service, prisma } = makeService();
      prisma.passwordResetToken.findFirst.mockResolvedValue(null);
      await expect(service.activateAccount('token', 'nova-lozinka-12')).rejects.toThrow(BadRequestException);
    });

    it('validan link postavlja lozinku, prelazi nalog u ACTIVE i piše audit log', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'prt1',
        userId: 'u1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await service.activateAccount('token', 'nova-lozinka-12');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.activated' }));
    });
  });

  describe('enrollMfa / confirmMfaEnrollment (M1 spec §5 — 10 rezervnih kodova, sekret enkriptovan)', () => {
    it('enrollMfa generiše sekret, čuva ga enkriptovan i vraća 10 hešovanih rezervnih kodova', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', email: 'user@tt.rs' });

      const result = await service.enrollMfa('u1');

      expect(result.recoveryCodes).toHaveLength(10);
      expect(prisma.mfaRecoveryCode.createMany).toHaveBeenCalled();
      const codesArg = prisma.mfaRecoveryCode.createMany.mock.calls[0][0].data;
      expect(codesArg).toHaveLength(10);
      // rezervni kodovi se čuvaju hešovani, ne sirovi
      expect(codesArg.every((c: { codeHash: string }) => !result.recoveryCodes.includes(c.codeHash))).toBe(true);

      const updateCall = prisma.user.update.mock.calls[0][0];
      expect(updateCall.data.mfaSecretEncrypted).not.toContain('secret'); // enkriptovan, ne plain
      expect(result.otpauthUrl).toContain('otpauth://');
    });

    it('confirmMfaEnrollment odbija ako podešavanje nije ni započeto', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', mfaSecretEncrypted: null });

      await expect(service.confirmMfaEnrollment('u1', '123456')).rejects.toThrow(BadRequestException);
    });

    it('confirmMfaEnrollment odbija pogrešan kod', async () => {
      const { service, prisma } = makeService();
      const secret = authenticator.generateSecret();
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', mfaSecretEncrypted: encryptSecret(secret) });

      await expect(service.confirmMfaEnrollment('u1', '000000')).rejects.toThrow(UnauthorizedException);
    });

    it('confirmMfaEnrollment sa ispravnim kodom uključuje mfaEnabled i piše audit log', async () => {
      const { service, prisma, auditLog } = makeService();
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', mfaSecretEncrypted: encryptSecret(secret) });

      await service.confirmMfaEnrollment('u1', validCode);

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { mfaEnabled: true } });
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.mfa_enabled' }));
    });
  });
});
