import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ArticleSourceType } from '@prisma/client';

// Nedostatak 3 (M17 Faza 7) — telo za POST /knowledge/articles/:id/research. Za razliku od
// ResearchFromTextDto (koji nosi articleId jer nije vezan za putanju), articleId ovde dolazi iz
// URL parametra :id. `revisionId` je opcion — kad je prosleđen (npr. postojeći PENDING_REVIEW
// SCHEDULED_REFRESH placeholder koji KnowledgeRefreshService kreira), popunjava TAJ red umesto
// da pravi nov (M23 spec §4c).
export class ResearchArticleDto {
  @IsString()
  sourceUrl!: string;

  @IsEnum(['HOTEL_OFFICIAL_WEBSITE', 'HOTEL_SOCIAL_MEDIA', 'GOVERNMENT_OR_TOURISM_BOARD'])
  sourceType!: ArticleSourceType;

  @IsString()
  rawText!: string;

  @IsOptional()
  @IsUUID()
  revisionId?: string;
}
