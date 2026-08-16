import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ArticleTranslationSource, LanguageCode } from '@prisma/client';

// M23 spec §2.2 — koristi se i za ručan unos u CreateArticleDto.translations[] i za buduće
// PUT /articles/:id/translations (nije u §8 tabeli kao poseban endpoint, ali zapisi u ovom
// obliku dolaze i iz ArticleRevisionsService.approve — proposedTranslations ima isti oblik).
export class UpsertArticleTranslationDto {
  @IsEnum(['sr', 'en', 'hr', 'sl', 'es', 'de', 'ru', 'fr'])
  languageCode!: LanguageCode;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsEnum(['MANUAL', 'AI_GENERATED'])
  translationSource?: ArticleTranslationSource;
}
