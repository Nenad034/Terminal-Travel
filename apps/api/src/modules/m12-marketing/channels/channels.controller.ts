import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ChannelsService } from './channels.service';
import { CreateChannelConfigDto } from './dto/create-channel-config.dto';
import { UpdateChannelConfigDto } from './dto/update-channel-config.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M12 spec §7, prefiks /api/v1/marketing
@ApiTags('marketing-channels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('marketing/channels')
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get()
  @RequirePermission('M12', 'channel-config', 'VIEW')
  findAll() {
    return this.channels.findAll();
  }

  @Post()
  @RequirePermission('M12', 'channel-config', 'EDIT')
  create(@Body() dto: CreateChannelConfigDto, @CurrentUser() actor: { userId: string }) {
    return this.channels.create(dto, actor.userId);
  }

  @Get(':code')
  @RequirePermission('M12', 'channel-config', 'VIEW')
  findOne(@Param('code') code: string) {
    return this.channels.findOne(code);
  }

  @Patch(':code')
  @RequirePermission('M12', 'channel-config', 'EDIT')
  update(@Param('code') code: string, @Body() dto: UpdateChannelConfigDto, @CurrentUser() actor: { userId: string }) {
    return this.channels.update(code, dto, actor.userId);
  }
}
