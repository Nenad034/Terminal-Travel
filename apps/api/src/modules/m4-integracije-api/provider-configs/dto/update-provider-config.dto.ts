import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, Min } from 'class-validator';
import { ProviderStatus, TipNastupanja } from '@prisma/client';

export class UpdateProviderConfigDto {
  @IsObject() @IsOptional() authConfig?: Record<string, unknown>;
  @IsObject() @IsOptional() capabilitiesProfile?: Record<string, unknown>;
  @IsEnum(ProviderStatus) @IsOptional() status?: ProviderStatus;
  @IsEnum(TipNastupanja) @IsOptional() defaultTipNastupanja?: TipNastupanja;
  @IsInt() @Min(1) @IsOptional() timeoutSearchMs?: number;
  @IsInt() @Min(1) @IsOptional() timeoutBookingMs?: number;
  @IsBoolean() @IsOptional() useMock?: boolean;
}
