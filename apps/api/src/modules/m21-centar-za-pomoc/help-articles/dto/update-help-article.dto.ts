import { ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

const AUDIENCE_VALUES = ['STAFF', 'SUBAGENT', 'BUSINESS_CLIENT'] as const;
const STATUS_VALUES = ['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'ARCHIVED'] as const;

// M21 spec §2.1/§6 — PATCH /help/articles/:id. Prelazak u status=PUBLISHED zahteva PUBLISH
// dozvolu (proverava servis, ne dozvola CRUD-a) i popunjava approved_by automatski sa
// pozivaocem — nikad se ne prima kroz telo zahteva (isto pravilo kao M12 ContentPiece.approve).
export class UpdateHelpArticleDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(AUDIENCE_VALUES, { each: true })
  audience?: ('STAFF' | 'SUBAGENT' | 'BUSINESS_CLIENT')[];

  @IsOptional()
  @IsString()
  relatedModule?: string;

  @IsOptional()
  @IsBoolean()
  isCriticalExample?: boolean;

  @IsOptional()
  @IsIn(STATUS_VALUES)
  status?: 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'ARCHIVED';
}
