import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProviderCallOperation } from '@prisma/client';
import { ProviderCallLogsService } from './provider-call-logs.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

@ApiTags('integrations-call-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('integrations/provider-call-logs')
export class ProviderCallLogsController {
  constructor(private readonly logs: ProviderCallLogsService) {}

  @Get()
  @RequirePermission('M4', 'provider-call-log', 'VIEW')
  find(
    @Query('providerCode') providerCode?: string,
    @Query('operation') operation?: ProviderCallOperation,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.logs.find({
      providerCode,
      operation,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }
}
