import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupplierInvoiceImportsService } from './supplier-invoice-imports.service';
import { CreateSupplierInvoiceImportDto } from './dto/create-import.dto';
import { ConfirmSupplierInvoiceRowDto } from './dto/confirm-row.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M10 spec §10, prefiks /api/v1/finance
@ApiTags('finance-supplier-invoice-imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance/supplier-invoice-imports')
export class SupplierInvoiceImportsController {
  constructor(private readonly imports: SupplierInvoiceImportsService) {}

  @Get()
  @RequirePermission('M10', 'supplier-invoice-import', 'VIEW')
  findAll() {
    return this.imports.findAll();
  }

  @Post()
  @RequirePermission('M10', 'supplier-invoice-import', 'CREATE')
  create(@Body() dto: CreateSupplierInvoiceImportDto, @CurrentUser() actor: { userId: string }) {
    return this.imports.create(dto, actor);
  }

  @Get(':id')
  @RequirePermission('M10', 'supplier-invoice-import', 'VIEW')
  findOne(@Param('id') id: string) {
    return this.imports.findOne(id);
  }

  @Post(':id/rows/:rowId/confirm')
  @RequirePermission('M10', 'supplier-invoice-import', 'REVIEW')
  confirmRow(
    @Param('id') id: string,
    @Param('rowId') rowId: string,
    @Body() dto: ConfirmSupplierInvoiceRowDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.imports.confirmRow(id, rowId, dto, actor);
  }

  @Post(':id/rows/:rowId/reject')
  @RequirePermission('M10', 'supplier-invoice-import', 'REVIEW')
  rejectRow(@Param('id') id: string, @Param('rowId') rowId: string, @CurrentUser() actor: { userId: string }) {
    return this.imports.rejectRow(id, rowId, actor);
  }
}
