import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { BookingStatus, SupplierManifestLanguage } from '@prisma/client';

// M5 spec §8.4 dopuna (v1.16) — POST /supplier-manifests/prepare-batch. bookingIds je
// isključiv ručni izbor (checkbox); inače bar JEDAN od preostalih filtera mora biti
// prisutan, a prisutni filteri se kombinuju (logičko I) — proverava se u servisu.
export class PrepareManifestsBatchDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @IsOptional()
  bookingIds?: string[];

  // rezervacije napravljene od-do (Booking.created_at)
  @IsDateString()
  @IsOptional()
  createdFrom?: string;

  @IsDateString()
  @IsOptional()
  createdTo?: string;

  // boravak preklapa opseg od-do (stay_from/stay_to)
  @IsDateString()
  @IsOptional()
  stayFrom?: string;

  @IsDateString()
  @IsOptional()
  stayTo?: string;

  // dolasci od-do (stay_from pada u opseg)
  @IsDateString()
  @IsOptional()
  arrivalFrom?: string;

  @IsDateString()
  @IsOptional()
  arrivalTo?: string;

  // odlasci od-do (stay_to pada u opseg)
  @IsDateString()
  @IsOptional()
  departureFrom?: string;

  @IsDateString()
  @IsOptional()
  departureTo?: string;

  @IsArray()
  @IsEnum(BookingStatus, { each: true })
  @IsOptional()
  bookingStatus?: BookingStatus[];

  @IsEnum(SupplierManifestLanguage)
  @IsOptional()
  language?: SupplierManifestLanguage;
}
