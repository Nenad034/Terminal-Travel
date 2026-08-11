import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { MarkupScopeType } from '@prisma/client';

// M5 spec §2.1
export class CreateMarkupRuleDto {
  @IsEnum(MarkupScopeType)
  scopeType!: MarkupScopeType;

  @IsString()
  scopeId!: string;

  @IsNumber()
  @IsOptional()
  percentage?: number;

  @IsInt()
  @IsOptional()
  fixedAmount?: number;

  @IsString()
  @IsOptional()
  fixedAmountCurrency?: string;

  @IsDateString()
  @IsOptional()
  activeFrom?: string;

  @IsDateString()
  @IsOptional()
  activeTo?: string;
}
