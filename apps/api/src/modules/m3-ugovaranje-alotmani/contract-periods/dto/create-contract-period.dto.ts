import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { AllotmentMode } from '@prisma/client';

// M3 spec §2.3/§2.3a
export class CreateContractPeriodDto {
  @IsDateString()
  stayFrom!: string;

  @IsDateString()
  stayTo!: string;

  @IsString()
  roomType!: string;

  @IsEnum(AllotmentMode)
  allotmentMode!: AllotmentMode;

  // FIXED / CHARTER / FIXED_LEASE
  @ValidateIf((o: CreateContractPeriodDto) => o.allotmentMode !== 'ON_REQUEST')
  @IsInt()
  @Min(1)
  totalCapacity?: number;

  // samo FIXED — nullable čak i tada (M3 spec §2.3: "release_days_before integer, nullable")
  @ValidateIf((o: CreateContractPeriodDto) => o.allotmentMode === 'FIXED' && o.releaseDaysBefore !== undefined)
  @IsInt()
  @Min(0)
  releaseDaysBefore?: number;

  // samo CHARTER/FIXED_LEASE
  @ValidateIf((o: CreateContractPeriodDto) => o.allotmentMode === 'CHARTER' || o.allotmentMode === 'FIXED_LEASE')
  @IsInt()
  @Min(1)
  ukupnaFiksnaObaveza?: number;

  @ValidateIf((o: CreateContractPeriodDto) => o.allotmentMode === 'CHARTER' || o.allotmentMode === 'FIXED_LEASE')
  @IsString()
  fixedObligationCurrency?: string;

  // samo FIXED_LEASE, nullable — niz {dueDate, amount}
  @ValidateIf((o: CreateContractPeriodDto) => o.allotmentMode === 'FIXED_LEASE' && o.paymentSchedule !== undefined)
  @IsArray()
  paymentSchedule?: { dueDate: string; amount: number }[];
}
