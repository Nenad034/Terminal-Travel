import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AgentInvocationLogService } from './agent-invocation-log.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

// M18 spec §9, prefiks /api/v1/ops
@ApiTags('ops-agent-invocations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ops/agent-invocations')
export class AgentInvocationsController {
  constructor(private readonly invocations: AgentInvocationLogService) {}

  @Get()
  @RequirePermission('M18', 'agent-invocation-log', 'VIEW')
  findAll(@Query('agentId') agentId?: string) {
    return this.invocations.findAll({ agentId });
  }
}
