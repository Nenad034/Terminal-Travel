import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// M1 spec §3.9b — izmena poslovnice. Bio `interface` u servisu (ValidationPipe ga preskače —
// zamka 13.8, dok. 50 nalaz 3.1); sad klasa, ista polja.
export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  responsiblePersonName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  licenseNumber?: string | null;
}
