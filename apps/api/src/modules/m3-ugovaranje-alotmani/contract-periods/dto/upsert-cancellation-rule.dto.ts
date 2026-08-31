import { IsEnum, IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { CancellationRuleType, EarlyDepartureBasis } from '@prisma/client';

// M3 spec §2.5 — dopuna v1.12: rule_type razdvaja PRE_ARRIVAL (postojeća polja) od
// EARLY_DEPARTURE (kazna za skraćenje već započetog boravka, nova polja). Tačno jedan
// skup polja se validira, zavisno od ruleType.
export class UpsertCancellationRuleDto {
  @IsEnum(CancellationRuleType)
  @IsOptional()
  ruleType?: CancellationRuleType = 'PRE_ARRIVAL';

  // samo PRE_ARRIVAL
  @ValidateIf((o: UpsertCancellationRuleDto) => (o.ruleType ?? 'PRE_ARRIVAL') === 'PRE_ARRIVAL')
  @IsInt()
  @Min(0)
  daysBeforeStay?: number;

  @ValidateIf((o: UpsertCancellationRuleDto) => (o.ruleType ?? 'PRE_ARRIVAL') === 'PRE_ARRIVAL')
  @IsInt()
  @Min(0)
  @Max(100)
  refundPercentage?: number;

  // samo EARLY_DEPARTURE
  @ValidateIf((o: UpsertCancellationRuleDto) => o.ruleType === 'EARLY_DEPARTURE')
  @IsEnum(EarlyDepartureBasis)
  earlyDepartureBasis?: EarlyDepartureBasis;

  @ValidateIf((o: UpsertCancellationRuleDto) => o.earlyDepartureBasis === 'PERCENTAGE_OF_REMAINING_STAY')
  @IsInt()
  @Min(0)
  @Max(100)
  earlyDeparturePercentage?: number;

  @ValidateIf((o: UpsertCancellationRuleDto) => o.earlyDepartureBasis === 'FLAT_AMOUNT')
  @IsInt()
  @Min(0)
  earlyDepartureFlatAmount?: number;
}
