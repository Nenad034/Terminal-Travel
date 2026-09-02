import { IsString, MaxLength, MinLength } from 'class-validator';

// M5 spec §4.3 dopuna (2.9.2026) — ispravka imena/prezimena putnika VEĆ na stavci (npr. gost
// javio da je ime pogrešno uneto). Namerno oba polja obavezna (ne parcijalno) — sprečava upis
// prazne vrednosti kroz izostavljeno polje na entitetu koji nema sopstveni prikaz "nepoznato".
export class UpdateBookingItemGuestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  guestFirstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  guestLastName!: string;
}
