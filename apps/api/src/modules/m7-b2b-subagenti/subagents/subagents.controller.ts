import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SubagentsService } from './subagents.service';
import { SubagentVolumeStatusService } from '../commission/subagent-volume-status.service';
import { CreateSubagentDto } from './dto/create-subagent.dto';
import { ApproveSubagentDto } from './dto/approve-subagent.dto';
import { UpdateSubagentDto } from './dto/update-subagent.dto';
import { UpdateChildCommissionDto } from './dto/update-child-commission.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M7 spec §11, prefiks /api/v1/b2b. Ownership (§6 vidljivost kroz hijerarhiju) se sprovodi u
// SubagentsService preko resolveCallerContext — @RequirePermission ovde je namerno širok (VIEW),
// isti obrazac kao M6 client-account/VIEW za GOST ulogu (servis sužava na "sopstveno").
@ApiTags('b2b-subagents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('b2b/subagents')
export class SubagentsController {
  constructor(
    private readonly subagents: SubagentsService,
    private readonly volumeStatus: SubagentVolumeStatusService,
  ) {}

  @Get()
  @RequirePermission('M7', 'subagent', 'VIEW')
  findMany(@CurrentUser() actor: { userId: string }) {
    return this.subagents.findMany(actor);
  }

  @Get(':id')
  @RequirePermission('M7', 'subagent', 'VIEW')
  findOne(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.subagents.findOne(id, actor);
  }

  @Post()
  @RequirePermission('M7', 'subagent', 'CREATE')
  create(@Body() dto: CreateSubagentDto, @CurrentUser() actor: { userId: string }) {
    return this.subagents.create(dto, actor);
  }

  @Post(':id/approve')
  @RequirePermission('M7', 'subagent', 'APPROVE')
  approve(@Param('id') id: string, @Body() dto: ApproveSubagentDto, @CurrentUser() actor: { userId: string }) {
    return this.subagents.approve(id, dto, actor);
  }

  @Patch(':id')
  @RequirePermission('M7', 'subagent', 'EDIT')
  update(@Param('id') id: string, @Body() dto: UpdateSubagentDto, @CurrentUser() actor: { userId: string }) {
    return this.subagents.update(id, dto, actor);
  }

  // §6/§11 — dostupno agenciji i roditeljskom SUBAGENT_ADMIN-u preko iste dozvole
  // (M7/subagent/MANAGE_OWN_NETWORK dodeljena i Vlasnik/Direktor u seed.ts, pored SUBAGENT_ADMIN
  // — spec §10 tabela navodi samo podrazumevanu dodelu, ne isključivost). Ownership (§3/§6) se
  // sprovodi u servisu preko resolveCallerContext.
  @Get(':id/children')
  @RequirePermission('M7', 'subagent', 'VIEW')
  children(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.subagents.children(id, actor);
  }

  @Post(':id/children')
  @RequirePermission('M7', 'subagent', 'MANAGE_OWN_NETWORK')
  createChild(@Param('id') id: string, @Body() dto: CreateSubagentDto, @CurrentUser() actor: { userId: string }) {
    return this.subagents.createChild(id, dto, actor);
  }

  @Patch(':id/children/:childId/commission')
  @RequirePermission('M7', 'subagent', 'MANAGE_OWN_NETWORK')
  async updateChildCommission(
    @Param('id') id: string,
    @Param('childId') childId: string,
    @Body() dto: UpdateChildCommissionDto,
    @CurrentUser() actor: { userId: string },
  ) {
    const effectiveParent = await this.volumeStatus.getEffectiveCommissionPercentage(id);
    return this.subagents.updateChildCommission(id, childId, dto, actor, effectiveParent);
  }

  @Get(':id/outstanding-balance')
  @RequirePermission('M7', 'subagent', 'VIEW')
  async outstandingBalance(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    await this.subagents.findOne(id, actor); // sprovodi ownership pre otkrivanja finansijskog podatka
    return this.subagents.outstandingBalance(id);
  }

  @Get(':id/volume-status')
  @RequirePermission('M7', 'subagent', 'VIEW')
  async volumeStatusFor(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    await this.subagents.findOne(id, actor);
    return this.volumeStatus.get(id);
  }
}
