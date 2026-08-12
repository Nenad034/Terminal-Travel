import { IsDateString, IsEmail, IsIn, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

// M6 spec §2.2 — POST /guest-profiles.
export class CreateGuestProfileDto {
  @IsString()
  fullName!: string;

  @IsIn(['PASSPORT', 'LICNA_KARTA'])
  documentType!: 'PASSPORT' | 'LICNA_KARTA';

  @IsString()
  documentNumber!: string;

  @IsString()
  nationality!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  linkedClientAccountId?: string;
}
