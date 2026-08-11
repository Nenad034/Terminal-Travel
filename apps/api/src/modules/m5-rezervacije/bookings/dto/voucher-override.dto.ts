import { IsString } from 'class-validator';

// M5 spec §6/§4.1/§11 — POST /bookings/:id/voucher/override, zahteva M5/voucher/OVERRIDE_ISSUE.
export class VoucherOverrideDto {
  @IsString()
  reason!: string;
}
