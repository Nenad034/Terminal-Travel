import { Type } from 'class-transformer';
import { IsDateString, IsString, ValidateNested } from 'class-validator';
import { OccupancyInputDto } from '../../quotes/dto/create-quote.dto';

// M5 spec §6/§11 — POST /bookings/:id/modify: "tretira se interno kao otkazivanje
// pogođene stavke + nova provera dostupnosti/cene za novi zahtev, prikazano kao jedna radnja."
export class ModifyBookingDto {
  @IsString()
  bookingItemId!: string;

  @IsDateString()
  stayFrom!: string;

  @IsDateString()
  stayTo!: string;

  @ValidateNested()
  @Type(() => OccupancyInputDto)
  occupancy!: OccupancyInputDto;
}
