import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AgeCategory, AllotmentMode } from '@prisma/client';

// M3 spec §2.3c — isti oblik kao M2 room_types[].age_policy[] (M2 spec §2.3b), samo camelCase
// (isto polje se u M5 obračunu cene čita direktno kao AgePolicyEntry[] iz
// apps/api/src/modules/m5-rezervacije/common/occupancy.ts, bez konverzije — vidi cast u
// quote-item-builder.service.ts).
export class AgePolicyOverrideEntryDto {
  @IsEnum(AgeCategory)
  category!: AgeCategory;

  @IsNumber()
  ageFrom!: number;

  @IsNumber()
  @IsOptional()
  ageTo?: number | null;

  @IsBoolean()
  countsTowardCapacity!: boolean;

  @IsInt()
  @IsOptional()
  maxCount?: number | null;

  @IsBoolean()
  @IsOptional()
  requiresCrib?: boolean;

  @IsBoolean()
  @IsOptional()
  cribIncluded?: boolean | null;
}

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

  // M3 spec §2.3c — izuzetak od opšte uzrasne politike sobe SAMO za ovaj period/cenovnik.
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgePolicyOverrideEntryDto)
  @IsOptional()
  agePolicyOverride?: AgePolicyOverrideEntryDto[];
}
