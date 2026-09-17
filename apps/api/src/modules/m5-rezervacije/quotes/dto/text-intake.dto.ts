import { IsArray, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/** M5 spec §3.0j.4 — `POST /sales/quotes/text-intake/extract`. */
export class TextIntakeExtractDto {
  @IsString()
  @MaxLength(20_000)
  text!: string;

  /** Odgovori na potpitanja iz prethodnog kruga (M15 §6.5.4.6, najviše dva kruga). */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  answers?: string[];
}

/** §3.0j.7 t. 3 — link zvaničnog sajta koji je čovek dao. */
export class TextIntakeSitePreviewDto {
  @IsUrl({ require_protocol: true })
  url!: string;
}
