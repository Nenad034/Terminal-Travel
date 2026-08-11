import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProviderConfigsService } from './provider-configs.service';
import { CreateProviderConfigDto } from './dto/create-provider-config.dto';
import { UpdateProviderConfigDto } from './dto/update-provider-config.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M4 spec §6/§7 — administrativni endpoint-i, prefiks /api/v1/integrations
@ApiTags('integrations-providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('integrations/providers')
export class ProviderConfigsController {
  constructor(private readonly providers: ProviderConfigsService) {}

  @Get()
  @RequirePermission('M4', 'provider-config', 'VIEW')
  findAll() {
    return this.providers.findAll();
  }

  @Post()
  @RequirePermission('M4', 'provider-config', 'CREATE')
  create(@Body() dto: CreateProviderConfigDto, @CurrentUser() actor: { userId: string }) {
    return this.providers.create(dto, actor.userId);
  }

  @Get(':code')
  @RequirePermission('M4', 'provider-config', 'VIEW')
  findOne(@Param('code') code: string) {
    return this.providers.findOne(code);
  }

  @Patch(':code')
  @RequirePermission('M4', 'provider-config', 'EDIT')
  update(@Param('code') code: string, @Body() dto: UpdateProviderConfigDto, @CurrentUser() actor: { userId: string }) {
    return this.providers.update(code, dto, actor.userId);
  }
}
