import { IsArray, IsEmail, IsOptional, IsPhoneNumber, IsString, IsUUID } from 'class-validator';

// M1 spec §7 — "Pozovi korisnika" forma: ime, email, telefon, uloge. Kreira nalog u statusu INVITED.
export class CreateUserDto {
  @IsString()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  roleIds!: string[];
}
