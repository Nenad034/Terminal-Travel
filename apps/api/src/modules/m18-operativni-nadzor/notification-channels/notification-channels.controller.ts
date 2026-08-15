import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationChannelsService } from './notification-channels.service';
import { CreateNotificationChannelDto } from './dto/create-notification-channel.dto';
import { UpdateNotificationChannelDto } from './dto/update-notification-channel.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

// M18 spec §9, prefiks /api/v1/ops
@ApiTags('ops-notification-channels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ops/notification-channels')
export class NotificationChannelsController {
  constructor(private readonly channels: NotificationChannelsService) {}

  @Get()
  @RequirePermission('M18', 'notification-channel', 'VIEW')
  findAll() {
    return this.channels.findAll();
  }

  @Post()
  @RequirePermission('M18', 'notification-channel', 'EDIT')
  create(@Body() dto: CreateNotificationChannelDto) {
    return this.channels.create(dto);
  }

  @Patch(':id')
  @RequirePermission('M18', 'notification-channel', 'EDIT')
  update(@Param('id') id: string, @Body() dto: UpdateNotificationChannelDto) {
    return this.channels.update(id, dto);
  }
}
