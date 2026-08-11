import { IsInt, Max, Min } from 'class-validator';

// M3 spec §2.5
export class UpsertCancellationRuleDto {
  @IsInt()
  @Min(0)
  daysBeforeStay!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  refundPercentage!: number;
}
