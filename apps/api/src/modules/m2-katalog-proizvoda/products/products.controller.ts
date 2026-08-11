import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LanguageCode, ProductStatus, ProductType, VisibleChannel } from '@prisma/client';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpsertTranslationDto } from './dto/upsert-translation.dto';
import { PublishProductDto } from './dto/publish-product.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M2 spec §7, interni kanal (M17) — pun oblik, uključuje source_* polja (§5.1 izuzetak).
@ApiTags('catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('catalog/products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermission('M2', 'product', 'VIEW')
  findAll(
    @Query('type') type?: ProductType,
    @Query('destinationCountry') destinationCountry?: string,
    @Query('status') status?: ProductStatus,
    @Query('channel') channel?: VisibleChannel,
    @Query('lang') lang?: LanguageCode,
  ) {
    return this.products.findAll({ type, destinationCountry, status, channel, lang });
  }

  @Post()
  @RequirePermission('M2', 'product', 'CREATE')
  create(@Body() dto: CreateProductDto, @CurrentUser() actor: { userId: string }) {
    return this.products.create(dto, actor.userId);
  }

  @Get(':id')
  @RequirePermission('M2', 'product', 'VIEW')
  findOne(@Param('id') id: string, @Query('lang') lang?: LanguageCode) {
    return this.products.findOne(id, lang);
  }

  @Patch(':id')
  @RequirePermission('M2', 'product', 'EDIT')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @CurrentUser() actor: { userId: string }) {
    return this.products.update(id, dto, actor.userId);
  }

  // DELETE = arhiviranje (M2 spec §7), ne fizičko brisanje.
  @Delete(':id')
  @RequirePermission('M2', 'product', 'DELETE')
  archive(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.products.archive(id, actor.userId);
  }

  @Get(':id/translations')
  @RequirePermission('M2', 'product', 'VIEW')
  listTranslations(@Param('id') id: string) {
    return this.products.listTranslations(id);
  }

  @Put(':id/translations')
  @RequirePermission('M2', 'product-translation', 'EDIT')
  upsertTranslation(
    @Param('id') id: string,
    @Body() dto: UpsertTranslationDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.products.upsertTranslation(id, dto, actor.userId);
  }

  @Post(':id/publish')
  @RequirePermission('M2', 'product', 'PUBLISH')
  publish(@Param('id') id: string, @Body() dto: PublishProductDto, @CurrentUser() actor: { userId: string }) {
    return this.products.publish(id, dto, actor.userId);
  }

  @Post('cache/sync')
  @RequirePermission('M2', 'product', 'EDIT')
  syncCache(@Body('productId') productId: string) {
    return this.products.syncCache(productId);
  }
}
