import { IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

// M15 spec §6.5.4, §9 — POST /ai-orchestration/omnisearch. `channel` ograničava obim ovog
// prvog prolaza na M17 (§6.5.5 — M7/M8 su van obima ove faze); `context` je rezervisano
// mesto za budući filter (npr. trenutna stranica) — nije korišćeno u ovom prolazu.
export class OmnisearchQueryDto {
  @IsString()
  @MinLength(1)
  query!: string;

  @IsIn(['INTERNAL_PANEL'])
  channel!: 'INTERNAL_PANEL';

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
