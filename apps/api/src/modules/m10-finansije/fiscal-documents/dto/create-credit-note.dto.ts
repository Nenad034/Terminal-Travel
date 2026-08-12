import { IsInt, IsString, Min } from 'class-validator';

// M10 spec §5.1a — KNJIZNO_ODOBRENJE nacrt, iz M7 CommissionRebate (M7 još ne postoji —
// iznos/subagent se prosleđuju direktno dok M7 ne bude specificiran, isti obrazac kao
// M5 Booking.client_account_id pre M6).
export class CreateCreditNoteDto {
  @IsString()
  relatedSubagentId!: string;

  @IsString()
  creditedRebateId!: string;

  @IsInt()
  @Min(1)
  amount!: number; // najmanja jedinica valute

  @IsString()
  currency!: string;
}
