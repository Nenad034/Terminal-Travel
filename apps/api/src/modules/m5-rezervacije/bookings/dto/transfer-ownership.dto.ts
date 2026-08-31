import { IsUUID } from 'class-validator';

// M5 spec §6.5 — POST /sales/bookings/:id/transfer-ownership, zahteva M5/booking/TRANSFER_OWNERSHIP.
export class TransferOwnershipDto {
  @IsUUID()
  newOwnerId!: string;
}
