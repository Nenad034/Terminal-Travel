import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * M3 spec §2.11l — potvrda trenutnog stanja cenovnika kao nove verzije (ručni tok).
 *
 * Ne nosi cene: cene su već upisane kroz mrežu. Nosi samo ono što verziju čini verzijom —
 * od kada važi i zašto je nastala.
 */
export class PotvrdiVerzijuDto {
  /** Od kog datuma nova cena važi. Rezervacije nastale ranije ostaju na staroj ceni. */
  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  /** §4.8 — rečenica kojom je izmena tražena, kad verzija nastaje izmenom rečima. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructionText?: string;

  /** §4.2 — uvoz iz kog je verzija nastala. */
  @IsOptional()
  @IsString()
  sourceImportId?: string;
}
