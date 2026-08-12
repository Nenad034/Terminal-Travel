import { Module } from '@nestjs/common';
import { PostTripSurveysService } from './post-trip-surveys.service';
import { PostTripSurveysController } from './post-trip-surveys.controller';
import { PublicPostTripSurveysController } from './public-post-trip-surveys.controller';
import { GoogleReviewConfigService } from './google-review-config';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

@Module({
  imports: [AuthModule, PermissionsModule],
  controllers: [PostTripSurveysController, PublicPostTripSurveysController],
  providers: [PostTripSurveysService, GoogleReviewConfigService],
  exports: [PostTripSurveysService],
})
export class PostTripSurveysModule {}
