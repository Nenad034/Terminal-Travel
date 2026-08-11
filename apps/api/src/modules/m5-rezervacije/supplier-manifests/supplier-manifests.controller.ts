import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupplierManifestsService } from './supplier-manifests.service';
import { GenerateManifestDto } from './dto/generate-manifest.dto';
import { PrepareManifestsBatchDto } from './dto/prepare-manifests-batch.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M5 spec §8/§11, prefiks /api/v1/sales
@ApiTags('sales-supplier-manifests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sales/supplier-manifests')
export class SupplierManifestsController {
  constructor(private readonly manifests: SupplierManifestsService) {}

  @Get()
  @RequirePermission('M5', 'supplier-manifest', 'VIEW')
  findAll(@Query('supplierId') supplierId?: string) {
    return this.manifests.findAll(supplierId);
  }

  @Post()
  @RequirePermission('M5', 'supplier-manifest', 'CREATE')
  generateDraft(@Body() dto: GenerateManifestDto, @CurrentUser() actor: { userId: string }) {
    return this.manifests.generateDraft(dto, actor.userId);
  }

  @Get(':id')
  @RequirePermission('M5', 'supplier-manifest', 'VIEW')
  findOne(@Param('id') id: string) {
    return this.manifests.findOne(id);
  }

  @Post(':id/send')
  @RequirePermission('M5', 'supplier-manifest', 'SEND')
  send(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.manifests.send(id, actor.userId);
  }

  @Post(':id/confirm-supplier')
  @RequirePermission('M5', 'supplier-manifest', 'SEND')
  confirmSupplier(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.manifests.confirmSupplier(id, actor.userId);
  }

  // M5 spec §8.4 dopuna (v1.16) — checkbox izbor više rezervacija ILI opseg datuma kreiranja;
  // priprema (nikad slanje) nacrta grupisanih po dobavljaču za sve nenajavljene stavke.
  @Post('prepare-batch')
  @RequirePermission('M5', 'supplier-manifest', 'CREATE')
  prepareBatch(@Body() dto: PrepareManifestsBatchDto, @CurrentUser() actor: { userId: string }) {
    return this.manifests.prepareBatch(
      {
        bookingIds: dto.bookingIds,
        createdFrom: dto.createdFrom,
        createdTo: dto.createdTo,
        stayFrom: dto.stayFrom,
        stayTo: dto.stayTo,
        arrivalFrom: dto.arrivalFrom,
        arrivalTo: dto.arrivalTo,
        departureFrom: dto.departureFrom,
        departureTo: dto.departureTo,
        bookingStatus: dto.bookingStatus,
      },
      actor.userId,
      dto.language,
    );
  }
}
