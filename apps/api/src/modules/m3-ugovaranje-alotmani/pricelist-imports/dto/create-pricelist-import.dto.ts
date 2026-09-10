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

  /**
   * §4.2.7 (v1.36) — putanja RELATIVNA na `PRICELIST_STORAGE_DIR`, ne URL. Popunjava je
   * `POST /pricelist-imports/upload`; ime polja je zadrzano da se ne lomi postojeci zapis.
   */
  @IsString()
  @IsOptional()
  sourceFileUrl?: string;

  /** §4.2.7 — originalno ime fajla, iskljucivo za prikaz coveku. */
  @IsString()
  @IsOptional()
  sourceFileName?: string;

  @IsEnum(PricelistSourceFormat)
  sourceFormat!: PricelistSourceFormat;
}
