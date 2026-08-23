import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BiTerminalService } from './bi-terminal.service';
import { BiTerminalQueryDto } from './dto/bi-terminal-query.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M15 spec §6.9/§9, prefiks /api/v1/ai-orchestration. `M15/bi-terminal/VIEW` je dodeljen
// isključivo VLASNIK ulozi u seed-u (§6.9.2) — PermissionsGuard sam sprovodi to ograničenje,
// nema dodatne provere ovde (isti obrazac kao svaki drugi @RequirePermission kontroler).
@ApiTags('ai-orchestration-bi-terminal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ai-orchestration/bi-terminal')
export class BiTerminalController {
  constructor(private readonly biTerminal: BiTerminalService) {}

  @Post('query')
  @RequirePermission('M15', 'bi-terminal', 'VIEW')
  query(@Body() dto: BiTerminalQueryDto, @CurrentUser() actor: { userId: string }) {
    return this.biTerminal.query(actor.userId, dto.query);
  }
}
