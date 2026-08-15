import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PresenceService } from './presence.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

// M19 spec §8 — GET /chat/presence. Gejtovano opštom internog-tima dozvolom
// (M19/conversation/VIEW) — ovo je namerno dovoljno da isključi SUPPLIER_CONTACT naloge (spec
// §9.6 — nemaju nijednu M19 dozvolu u katalogu), bez posebnog case-a u kodu.
@ApiTags('chat-presence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('chat/presence')
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  @Get()
  @RequirePermission('M19', 'conversation', 'VIEW')
  findAll() {
    return this.presence.findAll();
  }
}
