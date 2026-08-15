import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AiAgentBudgetsService } from './ai-agent-budgets.service';
import { CreateAiAgentBudgetDto } from './dto/create-ai-agent-budget.dto';
import { UpdateAiAgentBudgetDto } from './dto/update-ai-agent-budget.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

// M18 spec §9, prefiks /api/v1/ops
@ApiTags('ops-ai-agent-budgets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ops/ai-agent-budgets')
export class AiAgentBudgetsController {
  constructor(private readonly budgets: AiAgentBudgetsService) {}

  @Get()
  @RequirePermission('M18', 'ai-agent-budget', 'VIEW')
  findAll(@Query('agentId') agentId?: string) {
    return this.budgets.findAll({ agentId });
  }

  @Post()
  @RequirePermission('M18', 'ai-agent-budget', 'EDIT')
  create(@Body() dto: CreateAiAgentBudgetDto) {
    return this.budgets.create(dto);
  }

  @Patch(':id')
  @RequirePermission('M18', 'ai-agent-budget', 'EDIT')
  update(@Param('id') id: string, @Body() dto: UpdateAiAgentBudgetDto) {
    return this.budgets.update(id, dto);
  }
}
