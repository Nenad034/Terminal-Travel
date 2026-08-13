import { IsNumber, Max, Min } from 'class-validator';

// M7 spec §3 + §11 — PATCH /subagents/:id/children/:childId/commission. Ograda (dete ne sme
// dobiti veću proviziju od roditeljeve trenutne efektivne provizije) se sprovodi u servisu.
export class UpdateChildCommissionDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercentage!: number;
}
