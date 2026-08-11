import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

// M4 spec §2.1 — SearchParams
export class SearchProviderDto {
  @IsString() @IsOptional() destinationCountry?: string;
  @IsString() @IsOptional() destinationCity?: string;

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
