import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ArticleStatus } from '@prisma/client';

// M23 spec §8 — PATCH /articles/:id. status ide na ARCHIVED preko ovoga; PUBLISHED ide isključivo
// preko POST /articles/:id/publish (poglavlje 6/9 — potrebna dodatna provera, ne prost PATCH).
export class UpdateArticleDto {
  @IsOptional()
  @IsEnum(['DRAFT', 'PENDING_APPROVAL', 'ARCHIVED'])
  status?: Exclude<ArticleStatus, 'PUBLISHED'>;

  @IsOptional()
  @IsString()
  destinationCountry?: string;

  @IsOptional()
  @IsString()
  destinationCity?: string;
}
