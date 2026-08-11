import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { SupplierChangeNoticesService } from './supplier-change-notices.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

class SendChangeNoticeDto {
  @IsEmail()
  supplierEmail!: string;
}

// M5 spec §8.8/§10 — endpoint-i nisu poimenično u §11 tabeli (koja navodi "ključne"
// endpoint-e), ali dozvole M5/supplier-change-notice/CREATE,SEND i
// M5/supplier-confirmation/CONFIRM iz §10 zahtevaju stvarnu rutu koja ih sprovodi.
@ApiTags('sales-supplier-change-notices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sales/supplier-change-notices')
export class SupplierChangeNoticesController {
  constructor(private readonly notices: SupplierChangeNoticesService) {}

  @Get()
  @RequirePermission('M5', 'supplier-manifest', 'VIEW')
  findAll(@Query('bookingItemId') bookingItemId?: string) {
    return this.notices.findAll(bookingItemId);
  }

  @Get(':id')
  @RequirePermission('M5', 'supplier-manifest', 'VIEW')
  findOne(@Param('id') id: string) {
    return this.notices.findOne(id);
  }

  @Post(':id/send')
  @RequirePermission('M5', 'supplier-change-notice', 'SEND')
  send(@Param('id') id: string, @Body() dto: SendChangeNoticeDto, @CurrentUser() actor: { userId: string }) {
    return this.notices.send(id, dto.supplierEmail, actor.userId);
  }

  @Post(':id/confirm-supplier')
  @RequirePermission('M5', 'supplier-confirmation', 'CONFIRM')
  confirmSupplier(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.notices.confirmSupplier(id, actor.userId);
  }
}
