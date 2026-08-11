import { IsEnum } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

// M5 spec §5/§11 — PATCH /bookings/:id/payment-status: "poziva isključivo M10" (M10
// još ne postoji potpuno kao implementiran modul — ovo je interni state-update dok M10
// ne postoji, isti obrazac kao ostali TODO stub hook-ovi u ovom modulu).
export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatus)
  paymentStatus!: PaymentStatus;
}
