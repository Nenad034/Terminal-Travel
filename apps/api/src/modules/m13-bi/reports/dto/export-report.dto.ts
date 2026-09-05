import { IsIn, IsOptional, IsString } from 'class-validator';

const REPORT_KINDS = ['profitability', 'sales', 'occupancy', 'dynamic', 'marketing'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

const REPORT_FORMATS = ['EXCEL', 'PDF', 'HTML', 'PNG'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

// M13 spec §7 (v1.5 dopuna) — telo `/reports/export`. `rows`/`imageBase64` su međusobno
// isključivi i njihova "obavezno u zavisnosti od formata" provera se radi RUČNO u servisu
// (BadRequestException), ne preko class-validator uslovnih dekoratora (spec eksplicitno traži
// jednostavnu runtime proveru umesto složene uslovne dekoracije koja nije već ustaljen obrazac
// u ovom repou).
export class ExportReportDto {
  @IsIn(REPORT_KINDS)
  reportKind!: ReportKind;

  @IsString()
  title!: string;

  @IsIn(REPORT_FORMATS)
  format!: ReportFormat;

  @IsOptional()
  rows?: Record<string, unknown>[];

  @IsOptional()
  @IsString()
  imageBase64?: string;
}
