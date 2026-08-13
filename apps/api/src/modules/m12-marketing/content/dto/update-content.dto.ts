import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ContentChannel } from '@prisma/client';

// M12 spec §7 — PATCH /content/:id. status/approved_by/published_at nikad ovde — imaju
// sopstvene puteve (POST /content/:id/approve, cron za scheduled_publish_at), isti princip
// kao M2 UpdateProductDto (cena nikad polje, §4).
export class UpdateContentDto {
  @IsString()
  @IsOptional()
  slug?: string;

  @IsArray()
  @IsEnum(ContentChannel, { each: true })
  @IsOptional()
  targetChannels?: ContentChannel[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetTags?: string[];

  @IsBoolean()
  @IsOptional()
  containsAiGeneratedMedia?: boolean;

  @IsString()
  @IsOptional()
  scheduledPublishAt?: string;
}
