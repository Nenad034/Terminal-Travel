import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

// M1 spec §6 (dopuna 4.9.2026) — dodela dozvola ulozi. Lista, ne pojedinačna dozvola:
// ekran „Uloge" čuva sve izabrane čekbokse odjednom, a jedan zahtev znači i jedan zapis
// u audit logu sa punim pre/posle stanjem umesto niza pojedinačnih.
export class AddRolePermissionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissionIds!: string[];
}
