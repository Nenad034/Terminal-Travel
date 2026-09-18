import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { LeaveType } from '@prisma/client';

// M24 spec §2.3 / §3a — zahtev za odsustvo. `daysCount` ≥ 1: negativan broj bi UVEĆAVAO stanje
// godišnjeg odmora (`getLeaveBalance` sabira `daysCount` odobrenih zapisa) — dok. 50 nalaz 3.1.
// Spec §2.3 kaže da se broj RAČUNA pri unosu (radni dani); danas ga forma šalje ručno — to je
// zaseban, zabeležen nedostatak (dok. 50 nalaz 3.6), ne nešto što ovaj DTO rešava.
export class CreateLeaveRecordDto {
  @IsEnum(LeaveType)
  type!: LeaveType;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsInt()
  @Min(1)
  @Max(366)
  daysCount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}
