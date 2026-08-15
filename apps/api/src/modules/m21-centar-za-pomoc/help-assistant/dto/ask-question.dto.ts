import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const LANGUAGE_CODES = ['sr', 'en', 'hr', 'sl', 'es', 'de', 'ru', 'fr'] as const;

// M21 spec §6 — POST /help/ask. Publika se izvodi iz naloga koji pita (servis), NIKAD iz tela
// zahteva — zato nema audience/audience_context polja ovde (isto pravilo kao §2.3 model).
export class AskQuestionDto {
  @IsString()
  @MinLength(3)
  question!: string;

  @IsOptional()
  @IsIn(LANGUAGE_CODES)
  lang?: 'sr' | 'en' | 'hr' | 'sl' | 'es' | 'de' | 'ru' | 'fr';
}
