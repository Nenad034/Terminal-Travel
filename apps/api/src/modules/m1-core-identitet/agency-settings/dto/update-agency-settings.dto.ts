import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Odseca razmake PRE provere. Bez ovoga `MinLength(1)` propusta naziv od samih razmaka — '   '
// ima duzinu 3 i prolazi, a na ekranu bi izgledao kao prazno ime agencije. Nadjeno 7.9.2026
// probom kroz stvaran API poziv, ne citanjem koda: prva verzija je vratila 200 umesto 400.
const odseci = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

// M1 spec §3.9c. Sva polja su opciona (izmena je delimična), osim što `brandName`, KAD se
// šalje, ne sme biti prazan string — prazan naziv bi obrisao ime iz podnožja sajta i naslova
// svake stranice, a to nije podešavanje nego kvar.
export class UpdateAgencySettingsDto {
  @IsOptional()
  @odseci()
  @IsString()
  @MinLength(1, { message: 'Naziv agencije ne sme biti prazan.' })
  @MaxLength(200)
  brandName?: string;

  @IsOptional() @IsString() @MaxLength(200) legalName?: string | null;
  @IsOptional() @IsString() @MaxLength(300) address?: string | null;
  @IsOptional() @IsString() @MaxLength(50) taxId?: string | null;
  @IsOptional() @IsString() @MaxLength(100) licenseNumber?: string | null;
  @IsOptional() @IsString() @MaxLength(200) emergencyContact?: string | null;
  @IsOptional() @IsString() @MaxLength(200) email?: string | null;
  @IsOptional() @IsString() @MaxLength(100) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(200) website?: string | null;
}
