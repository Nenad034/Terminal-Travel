import { IsEnum, IsOptional, IsUUID, ValidateIf } from 'class-validator';

// M3 spec §7 — POST /pricelist-imports/:id/rows/:rowId/approve (CONFIRMED/MANUALLY_MATCHED)
// i .../reject (REJECTED), objedinjeno ovde isto kao M2 review endpoint.
export class ReviewRowDto {
  @IsEnum(['CONFIRMED', 'MANUALLY_MATCHED', 'REJECTED'] as const)
  decision!: 'CONFIRMED' | 'MANUALLY_MATCHED' | 'REJECTED';

  // Obavezno za MANUALLY_MATCHED kad AI nije predložio poklapanje (ili je pogrešno) — čovek bira proizvod.
  @ValidateIf((o: ReviewRowDto) => o.decision === 'MANUALLY_MATCHED')
  @IsUUID()
  matchedProductId?: string;
}
