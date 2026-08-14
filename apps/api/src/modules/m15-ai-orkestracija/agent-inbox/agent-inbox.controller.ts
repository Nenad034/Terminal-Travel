import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AgentInboxService } from './agent-inbox.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M15 spec §6/§9, prefiks /api/v1/ai-orchestration
@ApiTags('ai-orchestration-inbox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ai-orchestration/inbox')
export class AgentInboxController {
  constructor(private readonly inbox: AgentInboxService) {}

  @Get()
  @RequirePermission('M15', 'agent-inbox', 'VIEW')
  get(@CurrentUser() actor: { userId: string }) {
    return this.inbox.get(actor.userId);
  }
}
