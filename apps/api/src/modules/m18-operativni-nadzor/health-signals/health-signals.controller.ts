import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HealthSignalType, HealthSignalSeverity } from '@prisma/client';
import { HealthSignalsService } from './health-signals.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

// M18 spec §9, prefiks /api/v1/ops
@ApiTags('ops-health-signals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ops/health-signals')
export class HealthSignalsController {
  constructor(private readonly healthSignals: HealthSignalsService) {}

  @Get()
  @RequirePermission('M18', 'health-signal', 'VIEW')
  findAll(@Query('module') module?: string, @Query('type') type?: HealthSignalType, @Query('severity') severity?: HealthSignalSeverity) {
    return this.healthSignals.findAll({ module, type, severity });
  }
}
