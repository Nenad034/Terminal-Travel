import { IsEnum, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';
import { PricelistSourceFormat } from '@prisma/client';

// M3 spec §4.2.1 / §4.2.6 (v1.26)
export class CreatePricelistImportDto {
  @IsUUID()
  supplierId!: string;

  /**
   * §4.2.6 — TAČNO JEDNO od `sourceFileUrl`/`sourceText`. Fajl čeka odluku o skladištu; do tada
   * se uvozi nalepljen tekst, najčešće telo mejla dobavljača.
   *
   * Donja granica dužine postoji da prazan obrazac ne pokrene poziv jezičkom modelu koji sigurno
   * neće dati nijedan red — a naplaćuje se.
   */
  @ValidateIf((o: CreatePricelistImportDto) => !o.sourceFileUrl)
  @IsString()
  @MinLength(20, { message: 'Nalepljen tekst cenovnika je prekratak da bi sadržao ijedan red.' })
  sourceText?: string;

  @IsString()
  @IsOptional()
  sourceFileUrl?: string;

  @IsEnum(PricelistSourceFormat)
  sourceFormat!: PricelistSourceFormat;
}
