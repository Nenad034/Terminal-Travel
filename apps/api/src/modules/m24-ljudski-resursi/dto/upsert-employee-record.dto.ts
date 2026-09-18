import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ContractBasis, EmploymentType } from '@prisma/client';

// M24 spec §2.2 — HR dosije. Do 18.9.2026. ovo je bio `interface` u servisu, pa je globalni
// `ValidationPipe` telo tiho preskakao (zamka 13.8, dok. 50 nalaz 3.1): "nije datum" i nepoznata
// polja stizala su do Prisma-e. Klasa sa dekoratorima je jedini oblik koji pipe proverava.
export class UpsertEmployeeRecordDto {
  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @IsEnum(ContractBasis)
  contractBasis!: ContractBasis;

  @IsDateString()
  hireDate!: string;

  @IsOptional()
  @IsDateString()
  probationEndDate?: string | null;

  @IsOptional()
  @IsDateString()
  contractEndDate?: string | null;

  @IsOptional()
  @IsDateString()
  terminationDate?: string | null;

  @IsOptional()
  @IsUUID()
  reportsToUserId?: string | null;
}
