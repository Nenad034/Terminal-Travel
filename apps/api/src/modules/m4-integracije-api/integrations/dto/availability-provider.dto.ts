import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

// M4 spec §2.1 — StayParams, uz externalId proizvoda kod provajdera
export class AvailabilityProviderDto {
  @IsString()
  externalId!: string;

  @IsDateString()
  stayFrom!: string;

  @IsDateString()
  stayTo!: string;

  @IsInt()
  @Min(1)
  adults!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  children?: number;
}
