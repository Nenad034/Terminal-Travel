import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupplierAnnouncementRulesService } from './supplier-announcement-rules.service';
import { UpsertAnnouncementRuleDto } from './dto/upsert-announcement-rule.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M5 spec §8.7/§10/§11
@ApiTags('sales-supplier-announcement-rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sales/supplier-announcement-rules')
export class SupplierAnnouncementRulesController {
  constructor(private readonly rules: SupplierAnnouncementRulesService) {}

  @Get()
  @RequirePermission('M5', 'supplier-announcement-rule', 'VIEW')
  findAll() {
    return this.rules.findAll();
  }

  @Post()
  @RequirePermission('M5', 'supplier-announcement-rule', 'EDIT')
  create(@Body() dto: UpsertAnnouncementRuleDto, @CurrentUser() actor: { userId: string }) {
    return this.rules.create(dto, actor.userId);
  }

  @Patch(':id')
  @RequirePermission('M5', 'supplier-announcement-rule', 'EDIT')
  update(@Param('id') id: string, @Body() dto: UpsertAnnouncementRuleDto, @CurrentUser() actor: { userId: string }) {
    return this.rules.update(id, dto, actor.userId);
  }
}
