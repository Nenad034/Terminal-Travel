import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// M1 spec §6, prefiks /api/v1/iam (postavljen globalno u main.ts kao /api/v1)
@ApiTags('auth')
@Controller('iam/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
}
