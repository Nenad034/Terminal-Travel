import { IsDateString, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

/** M3 spec §2.8a — kapacitet za jedan dan/raspon; `capacity = null` vraća dan na kapacitet perioda. */
export class SetCapacityOverrideDto {
  @IsUUID()
  contractPeriodId!: string;

  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  capacity!: number | null;
}
