import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsString, ValidateNested } from 'class-validator';
import { OccupancyInputDto } from '../../quotes/dto/create-quote.dto';

// M5 spec §6/§11 — POST /bookings/:id/modify: "tretira se interno kao otkazivanje
// pogođene stavke + nova provera dostupnosti/cene za novi zahtev, prikazano kao jedna radnja."
export class ModifyBookingDto {
  @IsString()
  bookingItemId!: string;

  // §6 dopuna (2.9.2026, na zahtev vlasnika — kartica Aranžman) — opciona zamena USLUGE
  // (proizvoda), ne samo datuma/broja gostiju. Izostavljeno = zadržava postojeći proizvod
  // stavke, nepromenjeno ponašanje. Mora biti isti `ProductType` kao stavka koja se menja —
  // provera u `BookingsService.resolveModifiedItem`.
  @IsOptional()
  @IsString()
  productId?: string;

  @IsDateString()
  stayFrom!: string;

  @IsDateString()
  stayTo!: string;

  @ValidateNested()
  @Type(() => OccupancyInputDto)
  occupancy!: OccupancyInputDto;
}
