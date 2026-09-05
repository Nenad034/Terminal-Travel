import { ArrayUnique, IsArray, IsEnum, IsOptional } from 'class-validator';
import { ActivityTag, DestinationType } from '@prisma/client';

// M2 spec §2.1c — PATCH /catalog/destination-profiles/:id. Samo destinationType/activities se
// menjaju posle kreiranja — par (destinationCountry, destinationCity) je jedinstven i identifikuje
// profil, izmena para bi značila "drugu" destinaciju, ne izmenu ove.
export class UpdateDestinationProfileDto {
  @IsEnum(DestinationType)
  @IsOptional()
  destinationType?: DestinationType;

  @IsArray()
  @IsEnum(ActivityTag, { each: true })
  @ArrayUnique()
  @IsOptional()
  activities?: ActivityTag[];
}
