import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { LanguageCode, TranslationSource } from '@prisma/client';

// M2 spec §2.2 — ProductTranslation, jedan red po jeziku.
export class UpsertTranslationDto {
  @IsEnum(LanguageCode)
  languageCode!: LanguageCode;

  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsString()
  slug!: string;

  @IsEnum(TranslationSource)
  @IsOptional()
  translationSource?: TranslationSource;

  @IsBoolean()
  @IsOptional()
  isReviewed?: boolean;
}
