import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ContentChannel, ContentPieceType } from '@prisma/client';

// M12 spec §7 — POST /content: ručno kreiranje (čovek). generated_by je uvek HUMAN kroz ovaj
// endpoint — AI nacrti nastaju isključivo kroz M2 product.published pretplatnika (§3), nikad
// kroz ovaj API poziv.
export class CreateContentDto {
  @IsUUID()
  @IsOptional()
  productId?: string;

  @IsEnum(ContentPieceType)
  type!: ContentPieceType;

  // §3b — obavezno za STATIC_PAGE/BLOG_POST, proverava se u servisu (ne ovde — poruka treba
  // da referencira tip, DTO validator to ne ume prirodno).
  @IsString()
  @IsOptional()
  slug?: string;

  @IsArray()
  @IsEnum(ContentChannel, { each: true })
  targetChannels!: ContentChannel[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetTags?: string[];

  @IsBoolean()
  @IsOptional()
  containsAiGeneratedMedia?: boolean;

  @IsString()
  @IsOptional()
  scheduledPublishAt?: string; // ISO datum
}
