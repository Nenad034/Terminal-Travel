import { Type } from 'class-transformer';
import { IsDateString, IsString, ValidateNested } from 'class-validator';
import { OccupancyInputDto } from '../../quotes/dto/create-quote.dto';

// M5 spec §6.7/§11 — POST /bookings/:id/items (i /items/preview): dodavanje NOVE usluge na
// postojeću rezervaciju.
//
// Namerno bez `bookingItemId` (za razliku od `ModifyBookingDto`) — ovde se ništa ne zamenjuje
// nego dodaje, pa nema matične stavke. Iz istog razloga ovde NEMA ni provere „mora biti isti
// `ProductType`": kod izmene se stavka menja za drugu istu (hotel za hotel), ovde se dodaje
// usluga koja sa postojećima nema veze po tipu — transfer uz smeštaj je uobičajen slučaj, ne
// greška.
export class AddBookingItemDto {
  @IsString()
  productId!: string;

  @IsDateString()
  stayFrom!: string;

  @IsDateString()
  stayTo!: string;

  @ValidateNested()
  @Type(() => OccupancyInputDto)
  occupancy!: OccupancyInputDto;
}
