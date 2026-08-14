import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PushTokenService } from './push-token.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M9 spec §5/§7 v1.4 — bilo koji autentikovan mobilni korisnik (gost ili vodič) registruje
// sopstveni uređajski token, isti obrazac kao PermissionsController (samo JwtAuthGuard, bez
// PermissionsGuard — nema dozvole vezane za ovo, svako sme da registruje sopstveni token).
@ApiTags('mobile-push-token')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mobile/push-token')
export class PushTokenController {
  constructor(private readonly pushToken: PushTokenService) {}

  @Post()
  register(@Body() dto: RegisterPushTokenDto, @CurrentUser() actor: { userId: string }) {
    return this.pushToken.register(actor.userId, dto.pushToken);
  }
}
