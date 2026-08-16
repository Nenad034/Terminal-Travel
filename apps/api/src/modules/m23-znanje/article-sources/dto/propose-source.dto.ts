import { IsEnum, IsString } from 'class-validator';
import { ArticleSourceType } from '@prisma/client';

// M23 spec §2.3/§4a — ručno predlaganje kandidata izvora. sourceType sprovodi ogradu na nivou
// enuma (nema OTHER/OTA/REVIEW_SITE vrednosti).
export class ProposeSourceDto {
  @IsString()
  url!: string;

  @IsEnum(['HOTEL_OFFICIAL_WEBSITE', 'HOTEL_SOCIAL_MEDIA', 'GOVERNMENT_OR_TOURISM_BOARD'])
  sourceType!: ArticleSourceType;
}
