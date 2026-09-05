import { ArrayUnique, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { ActivityTag, DestinationType } from '@prisma/client';

// M2 spec §2.1c (dopuna 5.9.2026) — POST /catalog/destination-profiles. Čovek potvrđuje
// (eventualni budući AI predlog) pre upisa — ovaj DTO je ljudski unos/potvrda, ne sam predlog
// (poglavlje 7 Master dokumenta, "predloži pa čovek odobri" — predlog-tok van obima ovog prolaza,
// nema odluke o AI provajderu, isto ograničenje kao M2 §3.3 ProductContentImport).
export class CreateDestinationProfileDto {
  // Mora se poklapati sa kanonskim oblikom iz §2.1a — namerno se NE normalizuje ovde (za razliku
  // od Product.destinationCountry): profil destinacije referencira već postojeći, sređen naziv.
  @IsString()
  destinationCountry!: string;

  // Mora se poklapati sa stvarnim naseljem iz §2.1b (nikad regija).
  @IsString()
  destinationCity!: string;

  @IsEnum(DestinationType)
  destinationType!: DestinationType;

  // §2.1c — prazno/izostavljeno = "nepoznato", ne "nijedna" (isti princip kao amenities[]).
  @IsArray()
  @IsEnum(ActivityTag, { each: true })
  @ArrayUnique()
  @IsOptional()
  activities?: ActivityTag[];
}
