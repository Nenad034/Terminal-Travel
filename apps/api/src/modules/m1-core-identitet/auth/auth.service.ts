import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { EventBusService } from '../../../common/events/event-bus.service';
import { decryptSecret, encryptSecret, generateRawToken, hashToken } from '../../../common/crypto/secret-box';
import { ROLES_REQUIRING_MANDATORY_MFA, SYSTEM_ROLES } from '../roles/system-roles.constants';
import { RegisterDto } from './dto/register.dto';

const FAILED_ATTEMPTS_BEFORE_LOCK = 5; // M1 spec §5
const LOCK_DURATION_MINUTES = 15; // M1 spec §5
const ACCESS_TOKEN_TTL = '15m'; // M1 spec §3.7
const REFRESH_TOKEN_TTL_DAYS = 7; // M1 spec §3.7
const MFA_PENDING_TOKEN_TTL = '5m';
const PASSWORD_RESET_TTL_HOURS = 1; // M1 spec §5

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auditLog: AuditLogService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * M1 spec §5 — samostalna registracija gosta. Za razliku od `POST /users` (interno
   * osoblje, status INVITED, poziva ga neko sa M1/user/CREATE), ovde nalog nastaje
   * bez ičije dozvole (anoniman poziv) i odmah je ACTIVE — gost sam sebe registruje,
   * nema koga da "pozove". Emituje `user.registered.guest`; M6 na to pravi ClientAccount
   * (§5 M1 spec, §6 M6 spec) — M1 sam ne piše u M6 tabele.
   */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Nalog sa ovim email-om već postoji');

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone ?? null,
        accountType: 'GUEST',
        status: 'ACTIVE',
      },
    });

    // M1 spec §4 — GOST je sistemska uloga; registracija je jedini slučaj gde se uloga
    // dodeljuje bez ičije intervencije (assignedBy = sopstveni id, gost sam sebe registruje).
    const gostRole = await this.prisma.role.findUnique({ where: { name: SYSTEM_ROLES.GOST } });
    if (gostRole) {
      await this.prisma.userRole.create({
        data: { userId: user.id, roleId: gostRole.id, assignedBy: user.id },
      });
    }

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: user.id,
      module: 'M1',
      action: 'user.registered.guest',
      resourceType: 'User',
      resourceId: user.id,
      context: {},
    });
    await this.eventBus.emit('M1', 'user.registered.guest', {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
    });

    return this.issueTokens(user.id, null, null);
  }

  private async userRequiresMfa(userId: string): Promise<boolean> {
    const roles = await this.prisma.userRole.findMany({ where: { userId }, include: { role: true } });
    return roles.some((ur) => ROLES_REQUIRING_MANDATORY_MFA.includes(ur.role.name));
  }

  async login(email: string, password: string, ip: string | null) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Pogrešan email ili lozinka');

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Nalog je privremeno zaključan — pokušajte kasnije');
    }

    if (!user.passwordHash) {
      throw new ForbiddenException('Nalog čeka aktivaciju — postavite lozinku preko linka poslatog na email');
    }
    const passwordOk = await argon2.verify(user.passwordHash, password);
    if (!passwordOk) {
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= FAILED_ATTEMPTS_BEFORE_LOCK;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : attempts,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60_000) : null,
        },
      });
      await this.auditLog.write({
        actorType: 'HUMAN',
        actorId: user.id,
        module: 'M1',
        action: shouldLock ? 'user.locked' : 'auth.login_failed',
        resourceType: 'User',
        resourceId: user.id,
        context: { attempts },
        ipAddress: ip,
      });
      throw new UnauthorizedException('Pogrešan email ili lozinka');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(`Nalog nije aktivan (status: ${user.status})`);
    }

    // Uspešna lozinka — resetuj brojač neuspešnih pokušaja.
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });

    const requiresMfa = await this.userRequiresMfa(user.id);
    if (requiresMfa && !user.mfaEnabled) {
      // M1 spec §5: interna uloga mora podesiti 2FA pre prvog pristupa bilo čemu
      // osim stranice za podešavanje — ta stranica/endpoint je van obima ovog fajla.
      throw new ForbiddenException('Podešavanje dvofaktorske autentikacije je obavezno pre prijave — dovršite podešavanje 2FA.');
    }

    if (user.mfaEnabled) {
      const mfaToken = this.jwt.sign({ sub: user.id, type: 'mfa_pending' }, { expiresIn: MFA_PENDING_TOKEN_TTL });
      return { requiresMfa: true, mfaToken };
    }

    return this.issueTokens(user.id, ip, null);
  }

  async verifyMfa(mfaToken: string, code: string, ip: string | null, userAgent: string | null) {
    let payload: { sub: string; type: string };
    try {
      payload = this.jwt.verify(mfaToken);
    } catch {
      throw new UnauthorizedException('Nevažeći ili istekao MFA token');
    }
    if (payload.type !== 'mfa_pending') throw new UnauthorizedException();

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    if (!user.mfaSecretEncrypted) throw new ForbiddenException('MFA nije podešena za ovaj nalog');

    const secret = decryptSecret(user.mfaSecretEncrypted);
    const valid = authenticator.verify({ token: code, secret });
    if (!valid) throw new UnauthorizedException('Neispravan MFA kod');

    return this.issueTokens(user.id, ip, userAgent);
  }

  private async issueTokens(userId: string, ip: string | null, userAgent: string | null) {
    const sessionId = generateRawToken();
    const accessToken = this.jwt.sign({ sub: userId, sessionId }, { expiresIn: ACCESS_TOKEN_TTL });

    const rawRefreshToken = generateRawToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60_000);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawRefreshToken),
        expiresAt,
        ipAddress: ip ?? undefined,
        userAgent: userAgent ?? undefined,
      },
    });

    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: userId,
      module: 'M1',
      action: 'auth.login_success',
      resourceType: 'User',
      resourceId: userId,
      context: {},
      ipAddress: ip,
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  /** Refresh token rotira pri svakom korišćenju (M1 spec §3.7). */
  async refresh(rawRefreshToken: string, ip: string | null, userAgent: string | null) {
    const tokenHash = hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findFirst({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Nevažeći ili istekao refresh token');
    }

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(stored.userId, ip, userAgent);
  }

  /** `allDevices` opoziva sve refresh tokene korisnika, ne samo trenutni (M1 spec §6). */
  async logout(rawRefreshToken: string, allDevices: boolean) {
    const tokenHash = hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findFirst({ where: { tokenHash } });
    if (!stored) return;

    if (allDevices) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    }
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return; // ne otkrivati da li email postoji

    const rawToken = generateRawToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_HOURS * 60 * 60_000),
      },
    });
    // Slanje email-a je van obima ovog fajla (kanal, ne M1 poslovna logika) — TODO poveznica
    // sa stvarnim email servisom kad taj deo infrastrukture dođe na red.
    return rawToken;
  }

  async resetPassword(rawToken: string, newPassword: string) {
    if (newPassword.length < 12) throw new BadRequestException('Lozinka mora imati bar 12 karaktera');

    const tokenHash = hashToken(rawToken);
    const stored = await this.prisma.passwordResetToken.findFirst({ where: { tokenHash } });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new BadRequestException('Nevažeći ili istekao token za resetovanje lozinke');
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
      // Reset lozinke opoziva sve postojeće sesije — bezbednosna higijena.
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: stored.userId,
      module: 'M1',
      action: 'auth.password_reset',
      resourceType: 'User',
      resourceId: stored.userId,
      context: {},
    });
  }

  /**
   * M1 spec §5 — "Pozivanje novog korisnika: status INVITED → email sa linkom za
   * postavljanje lozinke". Isti mehanizam kao resetPassword (token-hash, 1h rok),
   * razlika je samo što ovde nalog prelazi iz INVITED u ACTIVE.
   */
  async createInviteToken(userId: string) {
    const rawToken = generateRawToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_HOURS * 60 * 60_000),
      },
    });
    return rawToken;
  }

  async activateAccount(rawToken: string, newPassword: string) {
    if (newPassword.length < 12) throw new BadRequestException('Lozinka mora imati bar 12 karaktera');

    const tokenHash = hashToken(rawToken);
    const stored = await this.prisma.passwordResetToken.findFirst({ where: { tokenHash } });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new BadRequestException('Nevažeći ili istekao link za aktivaciju');
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: stored.userId }, data: { passwordHash, status: 'ACTIVE' } }),
      this.prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
    ]);

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: stored.userId,
      module: 'M1',
      action: 'user.activated',
      resourceType: 'User',
      resourceId: stored.userId,
      context: {},
    });
  }

  /** Podešavanje 2FA — generiše secret, vraća otpauth URL za QR kod (ne štampa secret u plain obliku van ovoga). */
  async enrollMfa(userId: string) {
    const secret = authenticator.generateSecret();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const otpauthUrl = authenticator.keyuri(user.email, 'Terminal', secret);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretEncrypted: encryptSecret(secret) },
    });

    // 10 jednokratnih rezervnih kodova, hešovanih (M1 spec §5).
    const rawCodes = Array.from({ length: 10 }, () => generateRawToken().slice(0, 10));
    await this.prisma.mfaRecoveryCode.createMany({
      data: rawCodes.map((code) => ({ userId, codeHash: hashToken(code) })),
    });

    return { otpauthUrl, recoveryCodes: rawCodes };
  }

  async confirmMfaEnrollment(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecretEncrypted) throw new BadRequestException('MFA podešavanje nije započeto');

    const secret = decryptSecret(user.mfaSecretEncrypted);
    const valid = authenticator.verify({ token: code, secret });
    if (!valid) throw new UnauthorizedException('Neispravan MFA kod');

    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: userId,
      module: 'M1',
      action: 'auth.mfa_enabled',
      resourceType: 'User',
      resourceId: userId,
      context: {},
    });
  }
}
