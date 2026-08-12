import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CommunicationLogService } from './communication-log.service';
import { CreateCommunicationLogDto } from './dto/create-communication-log.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M6 spec §9, prefiks /api/v1/crm
@ApiTags('crm-communication-log')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crm/communication-log')
export class CommunicationLogController {
  constructor(private readonly communicationLog: CommunicationLogService) {}

  @Get()
  @RequirePermission('M6', 'communication-log', 'VIEW')
  findMany(@Query('clientAccountId') clientAccountId?: string, @Query('guestProfileId') guestProfileId?: string) {
    return this.communicationLog.findMany({ clientAccountId, guestProfileId });
  }

  @Post()
  @RequirePermission('M6', 'communication-log', 'CREATE')
  create(@Body() dto: CreateCommunicationLogDto) {
    return this.communicationLog.create(dto);
  }

  @Post(':id/mark-sent')
  @RequirePermission('M6', 'communication-log', 'CREATE')
  markSent(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.communicationLog.markSent(id, actor);
  }
}
