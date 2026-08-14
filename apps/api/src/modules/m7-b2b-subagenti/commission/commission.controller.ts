import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CommissionVolumeTiersService } from './commission-volume-tiers.service';
import { CommissionRebatesService } from './commission-rebates.service';
import { CreateVolumeTierDto } from './dto/create-volume-tier.dto';
import { UpdateVolumeTierDto } from './dto/update-volume-tier.dto';
import { RejectRebateDto } from './dto/reject-rebate.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AgentActionGuard } from '../../../common/guards/agent-action.guard';
import { AgentAction } from '../../../common/decorators/agent-action.decorator';

// M7 spec §11, prefiks /api/v1/b2b/subagents/:id/volume-tiers i .../commission-rebates.
@ApiTags('b2b-commission')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, AgentActionGuard)
@Controller('b2b/subagents/:id')
export class CommissionController {
  constructor(
    private readonly volumeTiers: CommissionVolumeTiersService,
    private readonly rebates: CommissionRebatesService,
  ) {}

  // §3.1 — isti autoritet kao osnovna provizija (agencija za Tier1, roditelj za sub-subagenta),
  // sprovedeno u CommissionVolumeTiersService preko CommissionAuthorityService. Guard dozvola je
  // namerno MANAGE_OWN_NETWORK (dodeljena i Vlasnik/Direktor) — isti obrazac kao subagents children.
  @Get('volume-tiers')
  @RequirePermission('M7', 'subagent', 'VIEW')
  findTiers(@Param('id') subagentId: string) {
    return this.volumeTiers.findMany(subagentId);
  }

  @Post('volume-tiers')
  @RequirePermission('M7', 'subagent', 'MANAGE_OWN_NETWORK')
  createTier(@Param('id') subagentId: string, @Body() dto: CreateVolumeTierDto, @CurrentUser() actor: { userId: string }) {
    return this.volumeTiers.create(subagentId, dto, actor);
  }

  @Patch('volume-tiers/:tierId')
  @RequirePermission('M7', 'subagent', 'MANAGE_OWN_NETWORK')
  updateTier(@Param('tierId') tierId: string, @Body() dto: UpdateVolumeTierDto, @CurrentUser() actor: { userId: string }) {
    return this.volumeTiers.update(tierId, dto, actor);
  }

  @Get('commission-rebates')
  @RequirePermission('M7', 'commission-rebate', 'VIEW')
  findRebates(@Param('id') subagentId: string) {
    return this.rebates.findMany(subagentId);
  }

  @Post('commission-rebates/:rebateId/approve')
  @RequirePermission('M7', 'commission-rebate', 'APPROVE')
  @AgentAction('M7', 'commission_rebate.apply')
  approveRebate(@Param('rebateId') rebateId: string, @CurrentUser() actor: { userId: string }) {
    return this.rebates.approve(rebateId, actor);
  }

  @Post('commission-rebates/:rebateId/reject')
  @RequirePermission('M7', 'commission-rebate', 'APPROVE')
  rejectRebate(@Param('rebateId') rebateId: string, @Body() dto: RejectRebateDto, @CurrentUser() actor: { userId: string }) {
    return this.rebates.reject(rebateId, dto.reason, actor);
  }
}
