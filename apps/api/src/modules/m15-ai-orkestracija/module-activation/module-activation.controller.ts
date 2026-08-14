import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ModuleActivationService } from './module-activation.service';
import { UpdateActivationDto } from './dto/update-activation.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M15 spec §9, prefiks /api/v1/ai-orchestration
@ApiTags('ai-orchestration-activation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ai-orchestration/modules')
export class ModuleActivationController {
  constructor(private readonly activation: ModuleActivationService) {}

  @Get(':code/activation')
  @RequirePermission('M15', 'module-activation', 'VIEW')
  get(@Param('code') code: string) {
    return this.activation.get(code);
  }

  @Patch(':code/activation')
  @RequirePermission('M15', 'module-activation', 'ACTIVATE')
  update(@Param('code') code: string, @Body() dto: UpdateActivationDto, @CurrentUser() actor: { userId: string }) {
    return this.activation.update(code, dto.status, actor.userId);
  }
}
