import {
  AncillaryKind,
  AncillaryPayable,
  AncillaryPriceBasis,
  AncillaryPricingMode,
} from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * M3 spec §2.11j/§2.11k — doplata ili popust sa dometom.
 *
 * Vrednosti nabrajanja se IZVODE iz Prisma enuma, nikad ne prepisuju rukom (zamka 7.8):
 * razlika između šeme i baze prolazi `tsc` i pada tek pri upisu, kao 500 nad pravim podacima.
 */
export class UpsertSurchargeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsEnum(AncillaryKind)
  kind?: AncillaryKind;

  @IsEnum(AncillaryPricingMode)
  pricingMode!: AncillaryPricingMode;

  /** Samo `FLAT_PER_UNIT` — najmanja jedinica valute ugovora (§2). */
  @IsOptional()
  @IsInt()
  @Min(0)
  flatAmount?: number;

  /** Samo `PERCENTAGE_OF_NIGHTLY_RATE`. Popust se piše kao pozitivan broj uz `kind = DISCOUNT`. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentageOfNightlyRate?: number;

  @IsEnum(AncillaryPriceBasis)
  priceBasis!: AncillaryPriceBasis;

  @IsOptional()
  @IsEnum(AncillaryPayable)
  payable?: AncillaryPayable;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  // ── domet (§2.11k). Prazno = ceo ugovor; sezona sužava; period sužava najviše.
  @IsOptional()
  @IsString()
  seasonId?: string;

  @IsOptional()
  @IsString()
  contractPeriodId?: string;

  /** Prazan niz ili izostavljeno = SVE sobe. Vlasnik traži obe mogućnosti. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  appliesToRoomTypes?: string[];

  // ── datumski opseg SAME stavke (Novogodišnja večera), različit od perioda boravka.
  @IsOptional()
  @IsDateString()
  appliesFrom?: string;

  @IsOptional()
  @IsDateString()
  appliesTo?: string;

  // ── uzrast (§2.11j) — boravišna taksa ima tri stepena u jednom jedinom pročitanom cenovniku.
  @IsOptional()
  @IsNumber()
  @Min(0)
  ageFrom?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ageTo?: number;

  // ── „za rezervacije od…do" (§2.11e).
  @IsOptional()
  @IsDateString()
  bookingFrom?: string;

  @IsOptional()
  @IsDateString()
  bookingTo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  coversPersons?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxAdults?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxChildren?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
