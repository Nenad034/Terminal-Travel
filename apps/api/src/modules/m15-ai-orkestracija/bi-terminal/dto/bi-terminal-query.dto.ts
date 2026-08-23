import { IsArray, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Dopuna (23.8.2026, uživo — "ai agent gubi kontekst": "kog su statusa te rezervacije" posle
// "koliko rezervacija ima u sistemu" nije prepoznalo na šta "te" referira, jer je svaki poziv
// bio nezavisan razgovor bez prethodnih pitanja/odgovora). Kratkotrajna istorija te iste sesije u
// browseru — panel je jedini koji je pamti (nema novog trajnog mehanizma, već postoji trajan
// audit log §6.9.4 za svaki pojedinačan upit).
export class BiTerminalHistoryTurnDto {
  @IsString()
  question!: string;

  @IsString()
  answer!: string;
}

// M15 spec §6.9, §9 — POST /ai-orchestration/bi-terminal/query.
export class BiTerminalQueryDto {
  @IsString()
  @MinLength(1)
  query!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BiTerminalHistoryTurnDto)
  history?: BiTerminalHistoryTurnDto[];
}
