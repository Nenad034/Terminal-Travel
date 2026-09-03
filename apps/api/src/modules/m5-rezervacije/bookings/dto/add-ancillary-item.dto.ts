import { IsInt, IsOptional, IsString, Min } from 'class-validator';

// M5 spec §6.7a — dodavanje doplate/popusta kao VEZANE stavke uz postojeću stavku rezervacije.
// Sama cena se NE prima od klijenta: računa se na serveru iz M3 `AncillaryService` (osnova,
// iznos/procenat) i podataka matične stavke (noći, sobe, osobe). Cena koju pošalje klijent je
// cena kojoj se ne veruje.
export class AddAncillaryItemDto {
  @IsString()
  ancillaryServiceId!: string;

  /** Koliko komada (ljubimci, dodatni ležajevi…). Podrazumevano 1; `max_quantity` proverava server. */
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;
}
