import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MarkupScopeType } from '@prisma/client';
import { MarkupRulesService } from './markup-rules.service';
import { CreateMarkupRuleDto } from './dto/create-markup-rule.dto';
import { UpdateMarkupRuleDto } from './dto/update-markup-rule.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M5 spec §11, prefiks /api/v1/sales
@ApiTags('sales-markup-rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sales/markup-rules')
export class MarkupRulesController {
  constructor(private readonly markupRules: MarkupRulesService) {}

  @Get()
  @RequirePermission('M5', 'markup-rule', 'VIEW')
  findAll(@Query('scopeType') scopeType?: MarkupScopeType, @Query('scopeId') scopeId?: string) {
    return this.markupRules.findAll(scopeType, scopeId);
  }

  @Post()
  @RequirePermission('M5', 'markup-rule', 'EDIT')
  create(@Body() dto: CreateMarkupRuleDto, @CurrentUser() actor: { userId: string }) {
    return this.markupRules.create(dto, actor.userId);
  }

  @Patch(':id')
  @RequirePermission('M5', 'markup-rule', 'EDIT')
  update(@Param('id') id: string, @Body() dto: UpdateMarkupRuleDto, @CurrentUser() actor: { userId: string }) {
    return this.markupRules.update(id, dto, actor.userId);
  }
}
