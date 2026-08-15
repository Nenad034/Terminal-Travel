import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LanguageCode } from '@prisma/client';
import { HelpArticlesService } from './help-articles.service';
import { CreateHelpArticleDto } from './dto/create-help-article.dto';
import { UpdateHelpArticleDto } from './dto/update-help-article.dto';
import { UpsertHelpArticleTranslationDto } from './dto/upsert-help-article-translation.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M21 spec §6, prefiks /api/v1/help. Namerno BEZ statičkog @RequirePermission na VIEW rute —
// vidljivost zavisi od publike IZVEDENE iz pozivaoca (audience_context, poglavlje 2.3), koja
// se ne zna unapred po ruti (isti princip kao M15 OmnisearchController — provera je unutar
// servisa). CREATE/PATCH/translations proveravaju EDIT/PUBLISH po audience segmentu unutar
// HelpArticlesService (payload-zavisno, ne staticki dekorator).
@ApiTags('help-articles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('help/articles')
export class HelpArticlesController {
  constructor(private readonly articles: HelpArticlesService) {}

  @Get()
  findAll(
    @CurrentUser() actor: { userId: string },
    @Query('relatedModule') relatedModule?: string,
    @Query('isCriticalExample') isCriticalExample?: string,
    @Query('lang') lang?: LanguageCode,
  ) {
    return this.articles.findVisibleToCaller(actor.userId, {
      relatedModule,
      isCriticalExample: isCriticalExample === undefined ? undefined : isCriticalExample === 'true',
      lang,
    });
  }

  @Post()
  create(@Body() dto: CreateHelpArticleDto, @CurrentUser() actor: { userId: string }) {
    return this.articles.create(dto, actor.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: { userId: string }, @Query('lang') lang?: LanguageCode) {
    return this.articles.findOne(id, actor.userId, lang);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHelpArticleDto, @CurrentUser() actor: { userId: string }) {
    return this.articles.update(id, dto, actor.userId);
  }

  @Put(':id/translations')
  upsertTranslation(
    @Param('id') id: string,
    @Body() dto: UpsertHelpArticleTranslationDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.articles.upsertTranslation(id, dto, actor.userId);
  }
}
