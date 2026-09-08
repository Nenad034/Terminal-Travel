import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
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
