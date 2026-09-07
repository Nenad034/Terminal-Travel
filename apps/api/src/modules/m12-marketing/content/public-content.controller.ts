import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ContentPieceType, LanguageCode } from '@prisma/client';
import { ContentService } from './content.service';
import { Public } from '../../../common/decorators/public.decorator';

/**
 * M12 spec §3b/§7 — javan kanal (M8 sajt). Bez autentikacije, isto opravdanje kao
 * PublicProductsController (M2): pristup je sam po sebi već ograničen na
 * status=PUBLISHED sadržaj sa M8_SITE u target_channels (ContentService.findPublishedBySlug).
 * Odvojen kontroler od ContentController (interni, M17) — pogrešno dodata dozvola
 * ovde ne bi mogla slučajno da izloži DRAFT/PENDING_APPROVAL sadržaj jer ova ruta
 * fizički nikad ne učitava ništa osim objavljenog.
 */
@ApiTags('marketing-public-content')
@Public()
@Controller('marketing/public/content')
export class PublicContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  findOne(@Query('type') type: ContentPieceType, @Query('slug') slug: string, @Query('lang') lang?: LanguageCode) {
    return this.content.findPublishedBySlug(type, slug, lang);
  }
}
