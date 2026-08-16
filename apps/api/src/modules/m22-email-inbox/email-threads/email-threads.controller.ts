import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EmailThreadsService } from './email-threads.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { LinkBookingDto } from './dto/link-booking.dto';
import { LinkSupplierAnnouncementDto } from './dto/link-supplier-announcement.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M22 spec §8 — @RequirePermission ovde je gruba kapija (M22/email-thread/*, katalog nivo);
// fina kapija (baš OVO sanduče) je MailboxAccess provera u EmailThreadsService (§2.2/§8) —
// isti dvoslojni obrazac kao M19 SupplierConversationAccess.
@ApiTags('email-threads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('email/threads')
export class EmailThreadsController {
  constructor(private readonly threads: EmailThreadsService) {}

  @Get()
  @RequirePermission('M22', 'email-thread', 'VIEW')
  findMany(
    @CurrentUser() user: { userId: string },
    @Query('mailboxId') mailboxId?: string,
    @Query('status') status?: string,
    @Query('correspondentType') correspondentType?: string,
  ) {
    return this.threads.findMany(user.userId, { mailboxId, status, correspondentType });
  }

  @Get(':id')
  @RequirePermission('M22', 'email-thread', 'VIEW')
  findOne(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.threads.findOne(id, user.userId);
  }

  @Post(':id/messages')
  @RequirePermission('M22', 'email-thread', 'REPLY')
  createMessage(@Param('id') id: string, @Body() dto: CreateMessageDto, @CurrentUser() user: { userId: string }) {
    return this.threads.createMessage(id, dto, user.userId);
  }

  @Post(':id/messages/:messageId/send')
  @RequirePermission('M22', 'email-thread', 'REPLY')
  sendDraft(@Param('id') id: string, @Param('messageId') messageId: string, @CurrentUser() user: { userId: string }) {
    return this.threads.sendDraft(id, messageId, user.userId);
  }

  @Post(':id/link-booking')
  @RequirePermission('M22', 'email-thread', 'REPLY')
  linkBooking(@Param('id') id: string, @Body() dto: LinkBookingDto, @CurrentUser() user: { userId: string }) {
    return this.threads.linkBooking(id, dto, user.userId);
  }

  @Post(':id/link-supplier-announcement')
  @RequirePermission('M22', 'email-thread', 'REPLY')
  linkSupplierAnnouncement(
    @Param('id') id: string,
    @Body() dto: LinkSupplierAnnouncementDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.threads.linkSupplierAnnouncement(id, dto, user.userId);
  }
}
