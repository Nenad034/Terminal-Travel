import { IsDateString, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

// M5 spec §2.1 — scope (scopeType/scopeId) se ne menja posle kreiranja pravila
// (kreiraj novo pravilo umesto premeštanja opsega na postojećem).
export class UpdateMarkupRuleDto {
  @IsNumber() @IsOptional() percentage?: number;
  @IsInt() @IsOptional() fixedAmount?: number;
  @IsString() @IsOptional() fixedAmountCurrency?: string;
  @IsDateString() @IsOptional() activeFrom?: string;
  @IsDateString() @IsOptional() activeTo?: string;
}
