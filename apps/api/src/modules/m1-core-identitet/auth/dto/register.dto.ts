import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

// M1 spec §5, §6 — samostalna registracija gosta (POST /iam/auth/register).
export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12)
  password!: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
