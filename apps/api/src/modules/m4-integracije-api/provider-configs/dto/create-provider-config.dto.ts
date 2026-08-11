import { IsEnum, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { ProviderAuthStrategy, ProviderCategory, TipNastupanja } from '@prisma/client';

// M4 spec §3.1
export class CreateProviderConfigDto {
  @IsString()
  providerCode!: string;

  @IsString()
  displayName!: string;

  @IsEnum(ProviderCategory)
  category!: ProviderCategory;

  // Otvoren objekat (npr. { endpoint, apiKey } ili { endpoint, login, password }) —
  // enkriptuje se pre upisa (§3.1 auth_config_encrypted), nikad se ne vraća u odgovoru.
  @IsObject()
  authConfig!: Record<string, unknown>;

  @IsEnum(ProviderAuthStrategy)
  authStrategy!: ProviderAuthStrategy;

  @IsObject()
  @IsOptional()
  capabilitiesProfile?: Record<string, unknown>;

  @IsInt()
  @Min(1)
  timeoutSearchMs!: number;

  @IsInt()
  @Min(1)
  timeoutBookingMs!: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  circuitFailureThreshold?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  circuitCooldownSeconds?: number;

  @IsEnum(TipNastupanja)
  @IsOptional()
  defaultTipNastupanja?: TipNastupanja;
}
