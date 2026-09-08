import { IsDateString, IsInt, IsString, IsUUID, Min, MinLength } from 'class-validator';

/**
 * M3 spec §2.8b — `reason` i `holdUntil` su OBAVEZNI, namerno na nivou DTO-a a ne "po dogovoru":
 * blokada bez roka je najsigurniji način da kapacitet tiho propadne do kraja sezone.
 */
export class CreateCapacityBlockDto {
  @IsUUID()
  contractPeriodId!: string;

  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;

  @IsInt()
  @Min(1)
  units!: number;

  @IsString()
  @MinLength(3)
  reason!: string;

  @IsDateString()
  holdUntil!: string;
}
