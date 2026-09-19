import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { TABLE_SOURCE_IDS, TableSourceId } from '../table-sources';

// M15 spec §6.5.4.10 — `POST /ai-orchestration/tables/run|export`. Filteri se validiraju
// protiv registra u servisu (`validateTableSpec`), ne ovde — DTO samo drži oblik.
export class TableCompareDto {
  @IsString() from!: string;
  @IsString() to!: string;
}

export class TableSpecDto {
  @IsIn(TABLE_SOURCE_IDS) source!: TableSourceId;
  @IsOptional() @IsObject() filters?: Record<string, string | string[]>;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) columns?: string[];
  @IsOptional() @ValidateNested() @Type(() => TableCompareDto) compare?: TableCompareDto;
}

export class RunTableDto {
  @ValidateNested() @Type(() => TableSpecDto) spec!: TableSpecDto;
}

export class TableTransformDto {
  @IsOptional() @IsArray() filters?: {
    column: string;
    op: 'contains' | 'gte' | 'lte' | 'eq' | 'neq';
    value: string;
  }[];
  @IsOptional() @IsObject() sort?: { column: string; dir: 'asc' | 'desc' };
  @IsOptional() @IsString() groupBy?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) hidden?: string[];
}

export class ExportTableDto extends RunTableDto {
  @IsIn(['EXCEL', 'PDF', 'HTML']) format!: 'EXCEL' | 'PDF' | 'HTML';
  @IsOptional() @ValidateNested() @Type(() => TableTransformDto) transform?: TableTransformDto;
  /** M17 §6e.4 — natpis scenarija u naslovu fajla (samo tekst; brojevi se NE šalju). */
  @IsOptional() @IsString() @MaxLength(200) scenarioLabel?: string;
}
