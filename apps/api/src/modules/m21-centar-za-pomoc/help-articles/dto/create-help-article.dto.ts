import { ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches } from 'class-validator';

const AUDIENCE_VALUES = ['STAFF', 'SUBAGENT', 'BUSINESS_CLIENT', 'PUBLIC_GUEST'] as const;

// M21 spec §2.1/§6 — POST /help/articles. Uvek kreira DRAFT (isti obrazac kao M12
// ContentPiece.create — nema poseban ljudski korak iz DRAFT, prelazak u PENDING_APPROVAL/
// PUBLISHED ide preko PATCH). `generatedBy` nije u telu — servis ga uvek postavlja na HUMAN
// za ovaj endpoint (AI nacrt nastaje isključivo kroz HelpSuggestionsService.approve, §5.4).
export class CreateHelpArticleDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug sme sadržati samo mala slova, brojeve i crticu.' })
  slug!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(AUDIENCE_VALUES, { each: true })
  audience!: ('STAFF' | 'SUBAGENT' | 'BUSINESS_CLIENT' | 'PUBLIC_GUEST')[];

  @IsOptional()
  @IsString()
  relatedModule?: string;

  @IsOptional()
  @IsBoolean()
  isCriticalExample?: boolean;
}
