import { Injectable } from '@nestjs/common';

// M6 spec §4.3 — statička konfiguracija agencije, isti obrazac kao M20 AgencyStaticConfigService
// (poglavlje 2.3, "kontakt za hitne slučajeve"). Čita se iz env promenljivih dok se ne doda
// panel za izmenu (M17).
const DEFAULT_GOOGLE_REVIEW_URL = 'https://g.page/r/terminal-travel/review';
const DEFAULT_RATING_THRESHOLD = 4;

@Injectable()
export class GoogleReviewConfigService {
  get(): { url: string; ratingThreshold: number } {
    return {
      url: process.env.AGENCY_GOOGLE_REVIEW_URL ?? DEFAULT_GOOGLE_REVIEW_URL,
      ratingThreshold: process.env.AGENCY_GOOGLE_REVIEW_RATING_THRESHOLD
        ? Number(process.env.AGENCY_GOOGLE_REVIEW_RATING_THRESHOLD)
        : DEFAULT_RATING_THRESHOLD,
    };
  }
}
