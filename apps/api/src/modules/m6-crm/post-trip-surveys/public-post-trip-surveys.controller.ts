import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PostTripSurveysService } from './post-trip-surveys.service';
import { SubmitPostTripSurveyDto } from './dto/submit-post-trip-survey.dto';

// M6 spec §4.3/§9 — gost pristupa preko access_token iz email-a, bez login naloga. Odvojen
// kontroler bez guard-ova (isti obrazac kao M2 PublicProductsController) — razdvajanje na nivou
// rute je namerna zaštita, ne oslanja se na to da front-end "samo ne prikaže" internu rutu.
@ApiTags('crm-post-trip-surveys-public')
@Controller('crm/post-trip-surveys')
export class PublicPostTripSurveysController {
  constructor(private readonly surveys: PostTripSurveysService) {}

  @Get(':token')
  findByToken(@Param('token') token: string) {
    return this.surveys.findByToken(token);
  }

  @Post(':token/submit')
  submit(@Param('token') token: string, @Body() dto: SubmitPostTripSurveyDto) {
    return this.surveys.submit(token, dto);
  }

  @Post(':token/google-review-click')
  recordGoogleReviewClick(@Param('token') token: string) {
    return this.surveys.recordGoogleReviewClick(token);
  }
}
