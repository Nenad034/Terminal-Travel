import { IsIn, IsOptional, IsUUID } from 'class-validator';

// M20 spec §6 — GET /client-contracts filteri.
export class ListClientContractsDto {
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'GENERATED', 'ACCEPTED', 'VOIDED'])
  status?: 'DRAFT' | 'GENERATED' | 'ACCEPTED' | 'VOIDED';
}
