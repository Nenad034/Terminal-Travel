import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LanguageCode } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * M23 spec §5/§8/§9 — javni, neautentifikovan kanal (poziva ga M8 `/znanje/:share_token` ruta,
 * van obima ovog prolaza — vidi CLAUDE.md, ne dirati apps/web). Isti obrazac kao M2
 * PublicProductsController/M12 PublicContentController — ODVOJEN, negardiran kontroler, servisni
 * sloj fizički učitava SAMO status=PUBLISHED i vraća TAČNO JEDAN članak, bez navigacije/liste
 * (izlazni kriterijum §9 — pogrešno dodat guard ovde ne bi mogao slučajno izložiti neobjavljen
 * sadržaj jer kontroler fizički ne učitava ništa van PUBLISHED).
 */
@ApiTags('knowledge-public')
@Controller('knowledge/public')
export class PublicKnowledgeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':shareToken')
  async findByShareToken(@Param('shareToken') shareToken: string, @Query('lang') lang?: LanguageCode) {
    const article = await this.prisma.article.findFirst({
      where: { shareToken, status: 'PUBLISHED' },
      include: { translations: true },
    });
    if (!article) throw new NotFoundException('Članak nije pronađen ili nije objavljen.');

    const { translations, ...rest } = article;
    const translation = resolveTranslation(translations, lang ?? 'sr');
    return { ...rest, translation };
  }
}

function resolveTranslation<T extends { languageCode: LanguageCode }>(translations: T[], requestedLang: LanguageCode): T | null {
  const byLang = (l: LanguageCode) => translations.find((t) => t.languageCode === l) ?? null;
  return byLang(requestedLang) ?? byLang('en') ?? byLang('sr') ?? null;
}
