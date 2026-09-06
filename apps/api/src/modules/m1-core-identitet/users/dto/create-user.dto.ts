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

  // M1 spec §3.1a (31.8.2026) — referenca ka M7 Subagent kad novi STAFF nalog pripada franšizi
  // (M7 spec §2.0.7). Prazno = nalog matične agencije, nepromenjeno ponašanje.
  @IsOptional()
  @IsUUID()
  linkedProfileId?: string;

  // M1 spec dopuna (6.9.2026) — matična poslovnica; opciono dok postoji samo jedna poslovnica.
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
