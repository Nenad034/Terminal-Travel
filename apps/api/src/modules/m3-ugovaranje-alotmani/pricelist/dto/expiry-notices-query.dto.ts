import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { OfferExpiryThreshold } from '@prisma/client';

/** M3 spec §6 — `GET /contracting/pricelist/expiry-notices?threshold=&acknowledged=`. */
export class ExpiryNoticesQueryDto {
  @IsEnum(OfferExpiryThreshold)
  @IsOptional()
  threshold?: OfferExpiryThreshold;

  // `@IsBooleanString` + `@Transform` u boolean = uvek 400 (validacija ide POSLE transformacije,
  // pa vidi `false`, ne `'false'`) — zamka 8.17. Zato `@IsBoolean` nad već pretvorenom vrednošću.
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : value === 'true' || value === true))
  acknowledged?: boolean;
}
