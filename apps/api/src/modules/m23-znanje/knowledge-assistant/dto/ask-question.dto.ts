import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { LanguageCode } from '@prisma/client';

export class AskQuestionDto {
  @IsString()
  @MinLength(3)
  question!: string;

  @IsOptional()
  @IsEnum(['sr', 'en', 'hr', 'sl', 'es', 'de', 'ru', 'fr'])
  lang?: LanguageCode;
}
