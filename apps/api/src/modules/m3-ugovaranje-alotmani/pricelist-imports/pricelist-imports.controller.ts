import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PricelistImportsService } from './pricelist-imports.service';
import { CreatePricelistImportDto } from './dto/create-pricelist-import.dto';
import { ReviewRowDto } from './dto/review-row.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AgentActionGuard } from '../../../common/guards/agent-action.guard';
import { AgentAction } from '../../../common/decorators/agent-action.decorator';

// M3 spec §6/§7, prefiks /api/v1/contracting
@ApiTags('contracting-pricelist-imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, AgentActionGuard)
@Controller('contracting/pricelist-imports')
export class PricelistImportsController {
  constructor(private readonly imports: PricelistImportsService) {}

  @Get()
  @RequirePermission('M3', 'pricelist-import', 'VIEW')
  findAll() {
    return this.imports.findAll();
  }

  @Post()
  @RequirePermission('M3', 'pricelist-import', 'CREATE')
  create(@Body() dto: CreatePricelistImportDto, @CurrentUser() actor: { userId: string }) {
    return this.imports.create(dto, actor.userId);
  }

  @Get(':id')
  @RequirePermission('M3', 'pricelist-import', 'VIEW')
  findOne(@Param('id') id: string) {
    return this.imports.findOne(id);
  }

  @Get(':id/rows')
  @RequirePermission('M3', 'pricelist-import', 'VIEW')
  listRows(@Param('id') id: string) {
    return this.imports.listRows(id);
  }

  @Post(':id/rows/:rowId/approve')
  @RequirePermission('M3', 'pricelist-import', 'APPROVE_ROW')
  @AgentAction('M3', 'pricelist_import.approve_row')
  approve(
    @Param('id') id: string,
    @Param('rowId') rowId: string,
    @Body() dto: ReviewRowDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.imports.reviewRow(id, rowId, dto, actor.userId);
  }

  @Post(':id/rows/:rowId/reject')
  @RequirePermission('M3', 'pricelist-import', 'APPROVE_ROW')
  reject(@Param('id') id: string, @Param('rowId') rowId: string, @CurrentUser() actor: { userId: string }) {
    return this.imports.reviewRow(id, rowId, { decision: 'REJECTED' }, actor.userId);
  }
}
