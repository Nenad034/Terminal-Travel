import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

/**
 * M3 spec §2.11i — marža i subagentska provizija na pojedinačnu stavku cenovnika.
 *
 * Jedan DTO za obe stvari namerno: na ekranu su to jedan red („Deluxe suite: marža 12% + 5,00,
 * provizija 8%"), pa bi dva odvojena poziva značila da red može ostati upisan do pola.
 */
export class UpsertPricingRuleDto {
  /** Na šta se pravilo odnosi. `RATE_LINE` je cenovna stavka, `ANCILLARY` doplata/popust. */
  @IsIn(['RATE_LINE', 'ANCILLARY'])
  target!: 'RATE_LINE' | 'ANCILLARY';

  @IsString()
  @MinLength(1)
  targetId!: string;

  // ── marža (MarkupRule). Oba polja se SABIRAJU kad su popunjena (M5 §2.1).
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  markupPercentage?: number;

  /** Najmanja jedinica valute (§2). */
  @IsOptional()
  @IsInt()
  @Min(0)
  markupFixedAmount?: number;

  @IsOptional()
  @IsString()
  markupCurrency?: string;

  // ── subagentska provizija (SubagentCommissionOverride)
  /** Prazno = pravilo važi za SVE subagente. */
  @IsOptional()
  @IsString()
  subagentId?: string;

  /** Izričita odluka „na ovoj stavci nema provizije" — različito od 0% (§2.11i). */
  @IsOptional()
  @IsBoolean()
  noCommission?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercentage?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  commissionFixedAmount?: number;

  @IsOptional()
  @IsDateString()
  activeFrom?: string;

  @IsOptional()
  @IsDateString()
  activeTo?: string;
}
