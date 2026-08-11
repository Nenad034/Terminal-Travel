import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProductContentImportsService } from './product-content-imports.service';
import { CreateImportDto } from './dto/create-import.dto';
import { ReviewFieldDto } from './dto/review-field.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M2 spec §7, prefiks /api/v1/catalog
@ApiTags('catalog-content-imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('catalog/product-content-imports')
export class ProductContentImportsController {
  constructor(private readonly imports: ProductContentImportsService) {}

  @Get()
  @RequirePermission('M2', 'product-content-import', 'VIEW')
  findAll() {
    return this.imports.findAll();
  }

  @Post()
  @RequirePermission('M2', 'product-content-import', 'CREATE')
  create(@Body() dto: CreateImportDto, @CurrentUser() actor: { userId: string }) {
    return this.imports.create(dto, actor.userId);
  }

  @Get(':id')
  @RequirePermission('M2', 'product-content-import', 'VIEW')
  findOne(@Param('id') id: string) {
    return this.imports.findOne(id);
  }

  @Post(':id/fields/:fieldId/review')
  @RequirePermission('M2', 'product-content-import', 'REVIEW_FIELD')
  reviewField(
    @Param('id') id: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: ReviewFieldDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.imports.reviewField(id, fieldId, dto, actor.userId);
  }
}
