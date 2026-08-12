import { IsEnum, IsInt, IsString, Min } from 'class-validator';
import { GuestRefundMethod } from '@prisma/client';

// M10 spec §8.5.3 `RefundInstruction` — refundacija gosta van kartičnog toka.
export class CreateRefundInstructionDto {
  @IsString()
  paymentId!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  currency!: string;

  @IsEnum(GuestRefundMethod)
  method!: GuestRefundMethod;
}
