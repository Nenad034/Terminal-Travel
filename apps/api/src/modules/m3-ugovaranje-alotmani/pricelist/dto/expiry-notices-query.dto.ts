import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_PAGE_SIZE } from '../../../../common/pagination/pagination';
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

  // Straničenje (dok. 50 nalaz 3.5). Ide u OVAJ DTO, ne kao zasebni `@Query('page')`, jer
  // `@Query() dto` sa `forbidNonWhitelisted` odbija svaki parametar koji nije u klasi
  // (pouka iz `common/pagination/pagination.ts`).
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;
}
