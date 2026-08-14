import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { FieldIncidentSeverity } from '@prisma/client';

// M9 spec §3.3 `FieldCheckIn` — id je KLIJENTSKI generisan UUID (idempotency_key), ne
// generiše ga server (§3.2 "klijentski generisan idempotency_key po zapisu").
export class FieldCheckInSyncDto {
  @IsUUID()
  id!: string;

  @IsUUID()
  bookingItemGuestId!: string;

  @IsISO8601()
  checkedInAt!: string;
}

// M9 spec §3.3 `FieldIncidentNote`.
export class FieldIncidentNoteSyncDto {
  @IsUUID()
  id!: string;

  @IsUUID()
  bookingId!: string;

  @IsString()
  @IsNotEmpty()
  note!: string;

  @IsEnum(FieldIncidentSeverity)
  severity!: FieldIncidentSeverity;

  @IsISO8601()
  createdAt!: string;
}

// M9 spec §3.2/§7 — POST /mobile/staff/sync: šalje ceo red čekanja odjednom.
export class SyncFieldDataDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => FieldCheckInSyncDto)
  checkIns?: FieldCheckInSyncDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => FieldIncidentNoteSyncDto)
  incidentNotes?: FieldIncidentNoteSyncDto[];
}
