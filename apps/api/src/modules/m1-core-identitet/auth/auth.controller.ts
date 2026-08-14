import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// M1 spec §6, prefiks /api/v1/iam (postavljen globalno u main.ts kao /api/v1)
@ApiTags('auth')
@Controller('iam/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.email, dto.password, req.ip ?? null);
  }

  @Post('mfa/verify')
  verifyMfa(@Body() dto: MfaVerifyDto, @Req() req: Request) {
    return this.auth.verifyMfa(dto.mfaToken, dto.code, req.ip ?? null, req.headers['user-agent'] ?? null);
  }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string, @Req() req: Request) {
    return this.auth.refresh(refreshToken, req.ip ?? null, req.headers['user-agent'] ?? null);
  }

  @Post('logout')
  logout(@Body('refreshToken') refreshToken: string, @Body('allDevices') allDevices?: boolean) {
    return this.auth.logout(refreshToken, Boolean(allDevices));
  }

  @Post('activate')
  activateAccount(@Body('token') token: string, @Body('newPassword') newPassword: string) {
    return this.auth.activateAccount(token, newPassword).then(() => ({ ok: true }));
  }

  @Post('password/forgot')
  forgotPassword(@Body('email') email: string) {
    return this.auth.requestPasswordReset(email).then(() => ({ ok: true }));
  }

  @Post('password/reset')
  resetPassword(@Body('token') token: string, @Body('newPassword') newPassword: string) {
    return this.auth.resetPassword(token, newPassword).then(() => ({ ok: true }));
  }

  @Post('mfa/enroll')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  enrollMfa(@Req() req: Request & { user: { userId: string } }) {
    return this.auth.enrollMfa(req.user.userId);
  }

  @Post('mfa/enroll/confirm')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  confirmMfaEnrollment(@Body('code') code: string, @Req() req: Request & { user: { userId: string } }) {
    return this.auth.confirmMfaEnrollment(req.user.userId, code).then(() => ({ ok: true }));
  }

  /**
   * M17 integracija (avgust 2026, minimalna dopuna otkrivena pri implementaciji panela) —
   * "ko sam ja i šta smem" za trenutno prijavljenog korisnika. Ne postoji poseban ključ
   * dozvole (svako sme da vidi SOPSTVENI profil/prava — GET /iam/users/:id to zahteva
   * M1/user/VIEW koje npr. Prodajni agent nema, pa ne može da posluži ovoj svrsi).
   * Prava se, kao i svuda u M1 (§3.6), računaju uživo nad bazom (PermissionsService),
   * nikad iz JWT payload-a (§3.7 — access token nosi samo user_id/session_id).
   */
  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request & { user: { userId: string } }) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: req.user.userId },
      include: { roles: { include: { role: true } } },
    });
    const permissions = await this.permissions.effectivePermissions(req.user.userId);
    return {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      accountType: user.accountType,
      status: user.status,
      roles: user.roles.map((r) => r.role.name),
      permissions,
    };
  }
}
