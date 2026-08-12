import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupplierObligationsService } from './supplier-obligations.service';
import { CreateSupplierObligationDto } from './dto/create-supplier-obligation.dto';
import { PaySupplierObligationDto } from './dto/pay-supplier-obligation.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M10 spec §10, prefiks /api/v1/finance
@ApiTags('finance-supplier-obligations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/supplier-obligations')
export class SupplierObligationsController {
  constructor(private readonly supplierObligations: SupplierObligationsService) {}

  @Get()
  @RequirePermission('M10', 'supplier-obligation', 'VIEW')
  findAll(@Query('supplierId') supplierId: string | undefined, @Query('status') status: string | undefined) {
    return this.supplierObligations.findAll({ supplierId, status });
  }

  @Post()
  @RequirePermission('M10', 'supplier-obligation', 'VIEW')
  create(@Body() dto: CreateSupplierObligationDto, @CurrentUser() actor: { userId: string }) {
    return this.supplierObligations.create(dto, actor);
  }

  @Post(':id/approve')
  @RequirePermission('M10', 'supplier-obligation', 'APPROVE')
  approve(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.supplierObligations.approve(id, actor);
  }

  @Post(':id/pay')
  @RequirePermission('M10', 'supplier-obligation', 'APPROVE')
  pay(@Param('id') id: string, @Body() dto: PaySupplierObligationDto, @CurrentUser() actor: { userId: string }) {
    return this.supplierObligations.pay(id, dto, actor);
  }
}
