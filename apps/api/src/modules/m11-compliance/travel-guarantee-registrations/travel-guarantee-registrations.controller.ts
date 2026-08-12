import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TravelGuaranteeRegistrationStatus } from '@prisma/client';
import { TravelGuaranteeRegistrationsService } from './travel-guarantee-registrations.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M11 spec §5, prefiks /api/v1/compliance
@ApiTags('compliance-travel-guarantee-registrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('compliance/travel-guarantee-registrations')
export class TravelGuaranteeRegistrationsController {
  constructor(private readonly registrations: TravelGuaranteeRegistrationsService) {}

  @Get()
  @RequirePermission('M11', 'travel-guarantee-registration', 'VIEW')
  findMany(@Query('status') status: TravelGuaranteeRegistrationStatus | undefined, @Query('bookingId') bookingId: string | undefined) {
    return this.registrations.findMany({ status, bookingId });
  }

  @Post(':id/retry')
  @RequirePermission('M11', 'travel-guarantee-registration', 'RETRY')
  retry(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.registrations.retry(id, actor);
  }
}
