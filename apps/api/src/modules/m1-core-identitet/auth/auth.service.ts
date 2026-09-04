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
// M1 spec §5 (dopuna 4.9.2026) — token za PRVO podešavanje 2FA. Kraći život nema smisla
// (skeniranje QR koda + prepisivanje rezervnih kodova traje), duži bi bespotrebno proširio
// prozor u kom postoji token izdat pre nego što je 2FA uopšte uključena.
const MFA_SETUP_TOKEN_TTL = '10m';
const MFA_PENDING_TOKEN_TTL = '5m';
const PASSWORD_RESET_TTL_HOURS = 1; // M1 spec §5
// M1 spec §5 (dopuna 4.9.2026) — pozivnica NIJE isto što i reset lozinke, pa ne deli rok.
// Reset traje 1h jer ga traži sam korisnik i odmah ga koristi; pozivnicu neko drugi mora
// proslediti (dok slanje email-a nije povezano, i ručno), pa bi rok od sat vremena istekao
// pre nego što pozvani uopšte vidi link.
const INVITE_TTL_HOURS = 48;

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
      await this.recordFailedAttempt(user.id, user.failedLoginAttempts, ip, 'auth.login_failed');
      throw new UnauthorizedException('Pogrešan email ili lozinka');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(`Nalog nije aktivan (status: ${user.status})`);
    }

    // Uspešna lozinka — resetuj brojač neuspešnih pokušaja.
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });

    const requiresMfa = await this.userRequiresMfa(user.id);
    if (requiresMfa && !user.mfaEnabled) {
      // M1 spec §5 (dopuna 4.9.2026, odluka vlasnika): interna uloga mora podesiti 2FA pre
      // prvog pristupa bilo čemu osim stranice za podešavanje. Ranije je ovde bacana greška,
      // pa se novozaposleni NIKAD nije mogao prijaviti — jedini enroll endpoint tražio je
      // access token koji se izdaje tek posle prijave (zatvoren krug, blokada i na
      // produkciji). Sada se izdaje uzak token koji otvara isključivo mfa/setup/* endpointe.
      const setupToken = this.jwt.sign({ sub: user.id, type: 'mfa_setup_pending' }, { expiresIn: MFA_SETUP_TOKEN_TTL });
      return { requiresMfaSetup: true, setupToken };
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
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Nalog je privremeno zaključan — pokušajte kasnije');
    }
    if (!user.mfaSecretEncrypted) throw new ForbiddenException('MFA nije podešena za ovaj nalog');

    const secret = decryptSecret(user.mfaSecretEncrypted);
    const valid = authenticator.verify({ token: code, secret });
    if (!valid) {
      // M1 spec §5 (dopunjeno 29.8.2026) — pogrešan MFA kod prati isti brojač/zaključavanje
      // kao pogrešna lozinka; do ove dopune se uopšte nije beležio ni brojao.
      await this.recordFailedAttempt(user.id, user.failedLoginAttempts, ip, 'auth.mfa_failed');
      throw new UnauthorizedException('Neispravan MFA kod');
    }

    // Uspešna MFA — resetuj brojač (isti obrazac kao uspešna lozinka u login()).
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });

    return this.issueTokens(user.id, ip, userAgent);
  }

  // M1 spec §5 — zajednička putanja za pogrešnu lozinku i pogrešan MFA kod: isti brojač
  // (`failed_login_attempts`), isto zaključavanje posle `FAILED_ATTEMPTS_BEFORE_LOCK`, isti
  // audit trag — namerno bez posebnog brojača/roka po koraku prijave.
  private async recordFailedAttempt(userId: string, currentAttempts: number, ip: string | null, failedAction: string) {
    const attempts = currentAttempts + 1;
    const shouldLock = attempts >= FAILED_ATTEMPTS_BEFORE_LOCK;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: shouldLock ? 0 : attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60_000) : null,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: userId,
      module: 'M1',
      action: shouldLock ? 'user.locked' : failedAction,
      resourceType: 'User',
      resourceId: userId,
      context: { attempts },
      ipAddress: ip,
    });
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
        expiresAt: new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60_000),
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

  /**
   * M1 spec §5/§6 (dopuna 4.9.2026) — prvo podešavanje 2FA, bez access tokena.
   * Prihvata ISKLJUČIVO `mfa_setup_pending` token koji `login` izdaje kad je lozinka
   * tačna a obavezna 2FA još nije uključena. Namerno odvojeno od `enrollMfa` (koji ostaje
   * iza JwtAuthGuard, za korisnika koji 2FA menja iz već prijavljene sesije).
   */
  private verifyMfaSetupToken(setupToken: string): string {
    let payload: { sub: string; type: string };
    try {
      payload = this.jwt.verify(setupToken);
    } catch {
      throw new UnauthorizedException('Nevažeći ili istekao token za podešavanje 2FA — prijavite se ponovo.');
    }
    if (payload.type !== 'mfa_setup_pending') {
      throw new UnauthorizedException('Nevažeći ili istekao token za podešavanje 2FA — prijavite se ponovo.');
    }
    return payload.sub;
  }

  /** Fail-closed provera zajednička za oba koraka podešavanja. */
  private async loadUserForMfaSetup(setupToken: string) {
    const userId = this.verifyMfaSetupToken(setupToken);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Nalog je privremeno zaključan — pokušajte kasnije');
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(`Nalog nije aktivan (status: ${user.status})`);
    }
    // Token vredi samo dok 2FA STVARNO nije uključena. Ako jeste (npr. podešavanje je u
    // međuvremenu završeno na drugom uređaju), ovaj put ne sme ponovo da generiše tajnu —
    // time bi se postojeći autentifikator tiho poništio.
    if (user.mfaEnabled) {
      throw new ForbiddenException('Dvofaktorska autentikacija je već podešena za ovaj nalog — prijavite se normalno.');
    }
    return user;
  }

  async startMfaSetup(setupToken: string) {
    const user = await this.loadUserForMfaSetup(setupToken);
    return this.enrollMfa(user.id);
  }

  async confirmMfaSetup(setupToken: string, code: string, ip: string | null, userAgent: string | null) {
    const user = await this.loadUserForMfaSetup(setupToken);
    if (!user.mfaSecretEncrypted) {
      throw new BadRequestException('Podešavanje 2FA nije započeto — pozovite /auth/mfa/setup/start.');
    }

    const secret = decryptSecret(user.mfaSecretEncrypted);
    if (!authenticator.verify({ token: code, secret })) {
      // Isti brojač i isto zaključavanje kao pogrešna lozinka i pogrešan mfa/verify kod
      // (M1 spec §5, dopuna 29.8.2026) — namerno bez posebnog brojača za ovaj korak.
      await this.recordFailedAttempt(user.id, user.failedLoginAttempts, ip, 'auth.mfa_failed');
      throw new UnauthorizedException('Neispravan MFA kod');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: true, failedLoginAttempts: 0, lockedUntil: null },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: user.id,
      module: 'M1',
      action: 'auth.mfa_enabled',
      resourceType: 'User',
      resourceId: user.id,
      context: { via: 'mfa_setup_pending' },
    });

    // Podešavanje je ujedno i dokaz identiteta (tačna lozinka + važeći TOTP) — nema razloga
    // terati korisnika da ponovo unosi lozinku odmah posle skeniranja QR koda.
    return this.issueTokens(user.id, ip, userAgent);
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
