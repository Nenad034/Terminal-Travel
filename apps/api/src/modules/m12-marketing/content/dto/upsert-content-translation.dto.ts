import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { LanguageCode, TranslationSource } from '@prisma/client';

// M12 spec §2.2 — ContentTranslation, jedan red po jeziku, isti obrazac kao M2 UpsertTranslationDto.
export class UpsertContentTranslationDto {
  @IsEnum(LanguageCode)
  languageCode!: LanguageCode;

  @IsString()
  title!: string;

  @IsString()
  body!: string;

  @IsEnum(TranslationSource)
  @IsOptional()
  translationSource?: TranslationSource;

  @IsBoolean()
  @IsOptional()
  isReviewed?: boolean;
}
