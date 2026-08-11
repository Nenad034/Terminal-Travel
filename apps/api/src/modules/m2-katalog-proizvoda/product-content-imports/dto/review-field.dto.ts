import { IsEnum, IsObject, IsOptional, ValidateIf } from 'class-validator';

// M2 spec §7 — POST /product-content-imports/:id/fields/:fieldId/review.
export class ReviewFieldDto {
  @IsEnum(['APPROVED', 'EDITED_AND_APPROVED', 'REJECTED'] as const)
  decision!: 'APPROVED' | 'EDITED_AND_APPROVED' | 'REJECTED';

  // Obavezno samo za EDITED_AND_APPROVED — izmenjena vrednost koja se upisuje umesto extracted_value.
  @ValidateIf((o: ReviewFieldDto) => o.decision === 'EDITED_AND_APPROVED')
  @IsObject()
  editedValue?: Record<string, unknown>;
}
