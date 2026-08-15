import { IsIn, IsString } from 'class-validator';

const LANGUAGE_CODES = ['sr', 'en', 'hr', 'sl', 'es', 'de', 'ru', 'fr'] as const;

// M21 spec §2.2 — isti obrazac kao M2 ProductTranslation / M12 ContentTranslation, isti
// LanguageCode skup (Prisma enum vrednosti prepisane ovde jer DTO sloj namerno ne uvozi
// @prisma/client tipove, isti stil kao ostali *.dto.ts fajlovi u repou).
export class UpsertHelpArticleTranslationDto {
  @IsIn(LANGUAGE_CODES)
  languageCode!: 'sr' | 'en' | 'hr' | 'sl' | 'es' | 'de' | 'ru' | 'fr';

  @IsString()
  title!: string;

  @IsString()
  body!: string;
}
