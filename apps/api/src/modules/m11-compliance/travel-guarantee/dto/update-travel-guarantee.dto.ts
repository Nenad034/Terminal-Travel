import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

// M11 spec §2.1/§5 — PATCH /travel-guarantee. Sva polja opciona: kad createNew=true (ili kad
// još ne postoji nijedan zapis) svi navedeni ispod postaju obavezni na nivou servisa
// (TravelGuaranteeService.update), ne ovde — jer isti DTO pokriva i "izmeni postojeću" i
// "unesi novu godišnju polisu" granu.
export class UpdateTravelGuaranteeDto {
  @IsOptional()
  @IsBoolean()
  createNew?: boolean;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  policyNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  coverageAmount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'EXPIRED', 'PENDING_RENEWAL'])
  status?: 'ACTIVE' | 'EXPIRED' | 'PENDING_RENEWAL';
}
