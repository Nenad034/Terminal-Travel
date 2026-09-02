import { IsString, MaxLength, MinLength } from 'class-validator';

// M5 spec §4.3 dopuna (2.9.2026, na zahtev vlasnika) — dodavanje putnika na već potvrđenu
// stavku (kartica Putnici). Namerno BEZ `guestProfileId` — ovo je M5 stub podatak (ime/prezime),
// vezivanje za M6 `GuestProfile` ostaje poseban, kasniji korak (isto ograničenje kao postojeći
// `BookingItemGuest` model, schema.prisma komentar §4.3).
export class CreateBookingItemGuestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  guestFirstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  guestLastName!: string;
}
