import { Controller, Get, Param, ParseIntPipe, Query, UseGuards, DefaultValuePipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProcessMapsService } from './process-maps.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

// M18 spec §9a, prefiks /api/v1/ops
@ApiTags('ops-process-maps')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ops/process-maps')
export class ProcessMapsController {
  constructor(private readonly processMaps: ProcessMapsService) {}

  @Get()
  @RequirePermission('M18', 'process-map', 'VIEW')
  findAll() {
    return this.processMaps.findAll();
  }

  @Get(':key/live')
  @RequirePermission('M18', 'process-map', 'VIEW')
  live(@Param('key') key: string, @Query('windowMinutes', new DefaultValuePipe(1440), ParseIntPipe) windowMinutes: number) {
    return this.processMaps.live(key, windowMinutes);
  }
}
