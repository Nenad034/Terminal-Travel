import { IsEnum, IsString, IsUUID } from 'class-validator';
import { ArticleSourceType } from '@prisma/client';

// M23 spec §4 — nije poseban endpoint u §8 tabeli (istraživanje se pokreće kroz POST /articles
// research{} polje, vidi CreateArticleDto), ali isti oblik ulaza koristi i
// KnowledgeRefreshService kad zaposleni ručno dostavi ažuriran tekst za osvežavanje.
export class ResearchFromTextDto {
  @IsUUID()
  articleId!: string;

  @IsString()
  sourceUrl!: string;

  @IsEnum(['HOTEL_OFFICIAL_WEBSITE', 'HOTEL_SOCIAL_MEDIA', 'GOVERNMENT_OR_TOURISM_BOARD'])
  sourceType!: ArticleSourceType;

  @IsString()
  rawText!: string;
}
