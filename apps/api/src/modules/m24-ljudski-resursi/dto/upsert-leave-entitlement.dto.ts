import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

// M24 spec §2.2a — dodeljeni dani godišnjeg odmora po godini. Gornja granica je gruba ograda
// protiv greške u kucanju (365 > svaki zakonski maksimum), ne poslovno pravilo.
export class UpsertLeaveEntitlementDto {
  @IsInt()
  @Min(0)
  @Max(365)
  daysEntitled!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  carriedOverDays?: number | null;

  @IsOptional()
  @IsDateString()
  carriedOverExpiresAt?: string | null;
}
