import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PostTripSurveysService } from './post-trip-surveys.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M6 spec §9, prefiks /api/v1/crm — interni uvid (dozvola). Javni tokenizovani endpoint-i su u
// PublicPostTripSurveysController, odvojen kontroler (isti obrazac kao M2 PublicProductsController).
@ApiTags('crm-post-trip-surveys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crm/post-trip-surveys')
export class PostTripSurveysController {
  constructor(private readonly surveys: PostTripSurveysService) {}

  @Get()
  @RequirePermission('M6', 'post-trip-survey', 'VIEW')
  findMany(@Query('bookingId') bookingId: string | undefined, @Query('status') status: string | undefined, @CurrentUser() actor: { userId: string }) {
    return this.surveys.findMany({ bookingId, status }, actor.userId);
  }
}
