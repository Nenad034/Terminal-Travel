import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ArticleSourceType, ArticleSubjectType } from '@prisma/client';
import { UpsertArticleTranslationDto } from './upsert-article-translation.dto';

// M23 spec §8 — POST /articles: "pokreće AI istraživanje (ArticleRevision, trigger=INITIAL_CREATION)
// za novi predmet, ILI ručan unos ako telo sadrži gotov tekst umesto zahteva za istraživanje".
// Isti endpoint grana na dva puta preko `research` (AI, poglavlje 4) vs `translations` (ručan
// unos, poglavlje 2.2) — nijedno od njih nije obavezno (prazan DRAFT je takođe validan, čeka
// naknadnu radnju).
class ResearchRequestDto {
  @IsString()
  sourceUrl!: string;

  @IsEnum(['HOTEL_OFFICIAL_WEBSITE', 'HOTEL_SOCIAL_MEDIA', 'GOVERNMENT_OR_TOURISM_BOARD'])
  sourceType!: ArticleSourceType;

  @IsString()
  rawText!: string;
}

export class CreateArticleDto {
  @IsEnum(['PRODUCT', 'DESTINATION', 'COUNTRY'])
  subjectType!: ArticleSubjectType;

  @ValidateIf((o: CreateArticleDto) => o.subjectType === 'PRODUCT')
  @IsUUID()
  productId?: string;

  @ValidateIf((o: CreateArticleDto) => o.subjectType === 'DESTINATION' || o.subjectType === 'COUNTRY')
  @IsString()
  destinationCountry?: string;

  @ValidateIf((o: CreateArticleDto) => o.subjectType === 'DESTINATION')
  @IsString()
  destinationCity?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertArticleTranslationDto)
  translations?: UpsertArticleTranslationDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ResearchRequestDto)
  research?: ResearchRequestDto;
}
