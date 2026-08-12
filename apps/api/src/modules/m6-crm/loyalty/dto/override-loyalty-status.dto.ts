import { IsString, IsUUID } from 'class-validator';

// M6 spec §3.2 — POST /loyalty-status/:clientAccountId/override. Razlog je obavezan.
export class OverrideLoyaltyStatusDto {
  @IsUUID()
  tierId!: string;

  @IsString()
  reason!: string;
}
