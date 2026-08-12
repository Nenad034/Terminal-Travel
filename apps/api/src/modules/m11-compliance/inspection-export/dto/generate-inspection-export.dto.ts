import { IsDateString } from 'class-validator';

// M11 spec §3/§5 — POST /inspection-export.
export class GenerateInspectionExportDto {
  @IsDateString()
  periodFrom!: string;

  @IsDateString()
  periodTo!: string;
}
