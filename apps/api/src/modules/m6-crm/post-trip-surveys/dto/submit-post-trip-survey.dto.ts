import { IsInt, IsObject, Max, Min } from 'class-validator';

// M6 spec §4.3, §9 — POST /post-trip-surveys/:token/submit (javni pristup, bez autentikacije).
export class SubmitPostTripSurveyDto {
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating!: number;

  @IsObject()
  responses!: Record<string, unknown>;
}
