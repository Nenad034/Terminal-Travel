import { IsArray, IsDateString, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// M5 spec §3.0.2 — dodavanje/brisanje/preslagivanje segmenata kroz PATCH; segments, kad je
// poslato, ZAMENJUJE ceo postojeći skup (jednostavan, deterministički obrazac za jezgro —
// finiji per-segment PATCH je UI/DX pitanje van obima ovog zadatka).
export class ItinerarySegmentInputDto {
  @IsInt()
  sequenceOrder!: number;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  destinationCountry?: string;

  @IsString()
  @IsOptional()
  destinationCity?: string;

  @IsDateString()
  @IsOptional()
  stayFrom?: string;

  @IsDateString()
  @IsOptional()
  stayTo?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateItineraryDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItinerarySegmentInputDto)
  @IsOptional()
  segments?: ItinerarySegmentInputDto[];
}
