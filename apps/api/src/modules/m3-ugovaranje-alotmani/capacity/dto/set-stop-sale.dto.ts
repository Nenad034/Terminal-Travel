import {
  ArrayNotEmpty,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CapacityStopSource } from '@prisma/client';

/**
 * M3 spec §2.8a — dve nezavisne dimenzije obima. `contractPeriodId` = jedan tip sobe;
 * `contractId` = svi periodi tog ugovora (ceo objekat). Tačno jedno od to dvoje.
 */
export class SetStopSaleDto {
  @IsUUID()
  @IsOptional()
  contractId?: string;

  @IsUUID()
  @IsOptional()
  contractPeriodId?: string;

  /**
   * §2.8a (v1.23) — IZABRANI tipovi soba, treća vrednost dimenzije „Šta" između jednog tipa i
   * celog objekta. `contractPeriodId` iznad ostaje radi postojećih poziva; ako stignu oba,
   * spajaju se u isti skup (servis ih razrešava zajedno).
   */
  @IsUUID('4', { each: true })
  @ArrayNotEmpty()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return Array.isArray(value) ? value : [value];
  })
  contractPeriodIds?: string[];

  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;

  /** Obavezan pri zatvaranju: "po čijoj informaciji" se traži kad nastane spor. */
  @ValidateIf((o: SetStopSaleDto) => o.source !== undefined)
  @IsEnum(CapacityStopSource)
  @IsOptional()
  source?: CapacityStopSource;

  @IsString()
  @IsOptional()
  reason?: string;
}
