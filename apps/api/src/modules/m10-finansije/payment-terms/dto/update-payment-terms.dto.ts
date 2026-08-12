import { IsInt, IsNumber, Min } from 'class-validator';

// M10 spec §5.4.1 `PaymentTermsConfig` — globalna agencijska politika (singleton).
export class UpdatePaymentTermsDto {
  @IsNumber()
  @Min(0)
  depositPercentage!: number;

  @IsInt()
  @Min(0)
  depositDueDaysAfterConfirmation!: number;

  @IsInt()
  @Min(0)
  balanceDueDaysBeforeStay!: number;

  @IsInt()
  @Min(0)
  escalationDaysAfterDue!: number;
}
