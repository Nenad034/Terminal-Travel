import { IsOptional, IsUUID } from 'class-validator';

// M5 spec §4.2 dopuna (M9 spec §4, avgust 2026) — dodeljuje interni panel (M17, koji još ne
// postoji kao implementacija — ova ruta je zamena dok M17 ne dođe na red). assignedGuideId
// je nullable (poništavanje dodele šalje null).
export class AssignGuideDto {
  @IsOptional()
  @IsUUID()
  assignedGuideId?: string | null;
}
