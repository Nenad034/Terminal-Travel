import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AiProviderQuotaService } from './ai-provider-quota.service';
import { CreateAiProviderQuotaDto } from './dto/create-ai-provider-quota.dto';
import { UpdateAiProviderQuotaDto } from './dto/update-ai-provider-quota.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M18 spec §9, prefiks /api/v1/ops
@ApiTags('ops-ai-provider-quota')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ops/ai-provider-quota')
export class AiProviderQuotaController {
  constructor(private readonly quota: AiProviderQuotaService) {}

  @Get()
  @RequirePermission('M18', 'ai-provider-quota', 'VIEW')
  findAll() {
    return this.quota.findAll();
  }

  // Nije formalno u spec §9 tabeli (samo GET/override), ali PATCH/POST postoje u §6.4 opisu
  // ("agreguje potrošnju... naspram globalnog kvota-limita") — konfiguracija limita mora imati
  // ulaz negde; koristi se isti VIEW+EDIT obrazac kao ostatak modula preko notification-channels.
  @Post()
  @RequirePermission('M18', 'ai-provider-quota', 'VIEW')
  create(@Body() dto: CreateAiProviderQuotaDto) {
    return this.quota.create(dto);
  }

  @Patch(':id')
  @RequirePermission('M18', 'ai-provider-quota', 'VIEW')
  update(@Param('id') id: string, @Body() dto: UpdateAiProviderQuotaDto) {
    return this.quota.update(id, dto);
  }

  @Post(':id/override')
  @RequirePermission('M18', 'ai-provider-quota', 'OVERRIDE')
  override(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.quota.override(id, actor.userId);
  }
}
