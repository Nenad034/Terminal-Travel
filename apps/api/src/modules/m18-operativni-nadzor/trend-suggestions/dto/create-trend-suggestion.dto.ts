import { IsEnum, IsString } from 'class-validator';
import { TrendSuggestionCategory } from '@prisma/client';

// M18 spec §5.1/§9 — POST /trend-suggestions. Uvek nastaje kao DRAFT (servis sam postavlja
// status/approved_by=null) — istraživanje (§5 "Tok") u ovom prolazu radi čovek (isti tip rada
// kao ranija Sabre analiza u ovom repozitorijumu), ne autonoman agent (nema web-search API u
// tehničkom steku, spec §11).
export class CreateTrendSuggestionDto {
  @IsEnum(TrendSuggestionCategory)
  category!: TrendSuggestionCategory;

  @IsString()
  summary!: string;

  @IsString()
  suggestedAction!: string;
}
