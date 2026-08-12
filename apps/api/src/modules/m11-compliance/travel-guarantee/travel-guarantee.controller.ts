import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TravelGuaranteeService } from './travel-guarantee.service';
import { UpdateTravelGuaranteeDto } from './dto/update-travel-guarantee.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M11 spec §5, prefiks /api/v1/compliance
@ApiTags('compliance-travel-guarantee')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('compliance/travel-guarantee')
export class TravelGuaranteeController {
  constructor(private readonly travelGuarantee: TravelGuaranteeService) {}

  @Get()
  @RequirePermission('M11', 'travel-guarantee', 'VIEW')
  findCurrent() {
    return this.travelGuarantee.findCurrent();
  }

  @Get('utilization')
  @RequirePermission('M11', 'travel-guarantee', 'VIEW')
  utilization() {
    return this.travelGuarantee.getUtilizationSnapshot();
  }

  @Patch()
  @RequirePermission('M11', 'travel-guarantee', 'EDIT')
  update(@Body() dto: UpdateTravelGuaranteeDto, @CurrentUser() actor: { userId: string }) {
    return this.travelGuarantee.update(dto, actor);
  }
}
