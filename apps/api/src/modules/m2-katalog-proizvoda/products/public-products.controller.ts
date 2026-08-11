import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LanguageCode, VisibleChannel } from '@prisma/client';
import { ProductsService } from './products.service';

/**
 * M2 spec §5.1 — javni kanal (buduće M7/M8/M9-gost). Bez autentikacije (isti nivo
 * pristupa kao javni sajt/portal) — pristup je sam po sebi već ograničen na
 * status=ACTIVE proizvode vidljive na traženom kanalu, i nikad ne vraća source_* polja
 * (ProductsService.findAllPublic/findOnePublic, poglavlje 5.1). Odvojen kontroler od
 * ProductsController (interni, M17) — razdvajanje na nivou rute je namerna zaštita:
 * pogrešno dodata @RequirePermission ovde ne bi mogla slučajno da izloži puna interna
 * polja jer ovaj kontroler ih fizički nikad ne učitava (serializer, ne guard).
 */
@ApiTags('catalog-public')
@Controller('catalog/public/products')
export class PublicProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll(@Query('channel') channel: VisibleChannel, @Query('lang') lang?: LanguageCode) {
    return this.products.findAllPublic(channel, lang);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('channel') channel: VisibleChannel, @Query('lang') lang?: LanguageCode) {
    return this.products.findOnePublic(id, channel, lang);
  }
}
