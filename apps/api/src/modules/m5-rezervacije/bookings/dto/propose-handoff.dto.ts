import { IsUUID } from 'class-validator';

// M5 spec §6.5 — POST /sales/bookings/:id/handoff-requests, zahteva M5/booking/TRANSFER_ASSIGNMENT.
export class ProposeHandoffDto {
  @IsUUID()
  toUserId!: string;
}
