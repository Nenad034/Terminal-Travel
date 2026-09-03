import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';
import { AncillaryKind, AncillaryPayable, AncillaryPriceBasis, AncillaryPricingMode } from '@prisma/client';

// M3 spec §2.6 — dopuna v1.12, prošireno v1.13 (3.9.2026, vlasnikova dopuna uz M5 §6.7a).
// `PUT` uvek KREIRA novi red (isti obrazac kao UpsertRateLineDto).
export class UpsertAncillaryServiceDto {
  @IsString()
  name!: string;

  // v1.13 — ista struktura nosi doplatu i popust. Iznos je UVEK pozitivan; znak nosi `kind`
  // (negativan iznos uz DISCOUNT bio bi dvostruka negacija, vidi `ancillary-pricing.ts`).
  @IsEnum(AncillaryKind)
  @IsOptional()
  kind?: AncillaryKind;

  @IsEnum(AncillaryPricingMode)
  pricingMode!: AncillaryPricingMode;

  @ValidateIf((o: UpsertAncillaryServiceDto) => o.pricingMode === 'FLAT_PER_UNIT')
  @IsInt()
  flatAmount?: number;

  @ValidateIf((o: UpsertAncillaryServiceDto) => o.pricingMode === 'PERCENTAGE_OF_NIGHTLY_RATE')
  @IsNumber()
  percentageOfNightlyRate?: number;

  // v1.13 — zamenjuje `unit`: osnova je PAR (osoba/soba × dan/period).
  @IsEnum(AncillaryPriceBasis)
  priceBasis!: AncillaryPriceBasis;

  /**
   * v1.13 — OBAVEZNO kad je osnova po sobi. Bez ovoga se cena po sobi ne može proveriti prema
   * stvarnom sastavu gostiju („doplata za sobu 20 EUR" ne znači ništa dok se ne zna koliko
   * osoba pokriva), pa se stavka koja to nema ne bi mogla ni primeniti — bolje 400 pri unosu
   * nego tiho pogrešna cena pri prodaji.
   */
  @ValidateIf((o: UpsertAncillaryServiceDto) => String(o.priceBasis ?? '').startsWith('PER_ROOM'))
  @IsInt()
  coversPersons?: number;

  @IsInt()
  @IsOptional()
  maxAdults?: number;

  @IsInt()
  @IsOptional()
  maxChildren?: number;

  /** v1.13 — `X,99` zapis, isti kao M2 `age_policy[].age_to` (ceo broj kao granica je dvosmislen). */
  @IsNumber()
  @IsOptional()
  childMaxAge?: number;

  /** v1.13 — `ON_SITE` iznos ne ulazi u ukupnu cenu aranžmana (M5 §6.7a), ali ide u ugovor i na vaučer. */
  @IsEnum(AncillaryPayable)
  @IsOptional()
  payable?: AncillaryPayable;

  @IsBoolean()
  @IsOptional()
  isMandatory?: boolean;

  @IsBoolean()
  @IsOptional()
  isRefundable?: boolean;

  @IsInt()
  @IsOptional()
  maxQuantity?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
