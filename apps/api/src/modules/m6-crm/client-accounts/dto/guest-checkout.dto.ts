import { IsEmail, IsOptional, IsString } from 'class-validator';

// M8 spec poglavlje 3, korak 3 (dopuna avgust 2026) — "nastavi kao gost bez naloga".
// Namerno samo minimalna polja koja M10 fiskalnom dokumentu trebaju (M6 spec §2.1
// ClientAccount) — putni dokument (GuestProfile, M6 spec §2.2) se i dalje NE
// prikuplja ovde, isti obrazac kao postojeći `user.registered.guest` tok
// (M6EventSubscribersService — GuestProfile se pravi tek kad gost stvarno unese
// te podatke, tok rezervacije ili /nalog/profil).
export class GuestCheckoutDto {
  @IsString()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
