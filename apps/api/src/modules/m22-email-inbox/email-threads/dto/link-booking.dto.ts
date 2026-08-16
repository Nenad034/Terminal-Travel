import { IsUUID } from 'class-validator';

// M22 spec §8 — POST /threads/:id/link-booking, zahteva REPLY (M22 §7). Upisuje isključivo
// EmailThread.related_booking_id (weak ref -> M5 Booking) — nikad ne dodiruje M5 podatke.
export class LinkBookingDto {
  @IsUUID()
  bookingId!: string;
}
