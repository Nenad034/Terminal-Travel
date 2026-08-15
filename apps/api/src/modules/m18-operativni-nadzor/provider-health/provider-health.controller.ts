import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProviderHealthService } from './provider-health.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

// M18 spec §9, prefiks /api/v1/ops
@ApiTags('ops-provider-health')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ops/provider-health')
export class ProviderHealthController {
  constructor(private readonly providerHealth: ProviderHealthService) {}

  @Get()
  @RequirePermission('M18', 'provider-health', 'VIEW')
  findAll() {
    return this.providerHealth.findAll();
  }
}
