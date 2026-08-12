import { IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

// M6 spec §2.1 — POST /client-accounts.
export class CreateClientAccountDto {
  @IsIn(['INDIVIDUAL', 'LEGAL_ENTITY'])
  accountType!: 'INDIVIDUAL' | 'LEGAL_ENTITY';

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
