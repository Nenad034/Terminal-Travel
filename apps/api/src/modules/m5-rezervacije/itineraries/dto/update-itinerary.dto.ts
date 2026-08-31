import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductSourceType } from '@prisma/client';
import { OccupancyInputDto } from '../../quotes/dto/create-quote.dto';

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

  // dopuna 31.8.2026 (§3.0.2) — segment ostaje u itineraru ali se isključuje iz zbira/konverzije
  // bez brisanja; podrazumevano uključen kad nije poslato (nazadnokompatibilno).
  @IsBoolean()
  @IsOptional()
  isIncluded?: boolean;

  // dopuna 31.8.2026 (§3.0.2) — isti oblik kao QuoteItem.occupancy (§3.2/3.2a), po segmentu.
  @ValidateNested()
  @Type(() => OccupancyInputDto)
  @IsOptional()
  occupancy?: OccupancyInputDto;

  // dopuna 31.8.2026 (§3.0.2) — informativna procena cene, snimljena iz SearchResultOffer u
  // trenutku izbora; nikad obavezujuća, ponovo se računa pri konverziji (§3.0.3).
  @IsInt()
  @Min(0)
  @IsOptional()
  previewBaseCost?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  previewFinalPrice?: number;

  @IsString()
  @IsOptional()
  previewFinalPriceCurrency?: string;

  @IsEnum(ProductSourceType)
  @IsOptional()
  previewSourceType?: ProductSourceType;
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
