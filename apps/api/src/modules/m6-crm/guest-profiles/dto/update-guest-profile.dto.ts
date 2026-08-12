import { IsDateString, IsEmail, IsIn, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

// M6 spec §2.2 — PATCH /guest-profiles/:id. Sva polja opciona.
export class UpdateGuestProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsIn(['PASSPORT', 'LICNA_KARTA'])
  documentType?: 'PASSPORT' | 'LICNA_KARTA';

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

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
