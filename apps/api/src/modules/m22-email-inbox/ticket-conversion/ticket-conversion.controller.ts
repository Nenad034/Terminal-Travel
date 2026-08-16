import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TicketConversionService } from './ticket-conversion.service';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M22 spec §8 — POST /email/threads/:id/convert-to-ticket, isti dozvolski krug kao REPLY
// (M22/email-thread/CONVERT_TO_TICKET, §7), fina kapija je MailboxAccess (servisni sloj).
@ApiTags('email-threads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('email/threads')
export class TicketConversionController {
  constructor(private readonly ticketConversion: TicketConversionService) {}

  @Post(':id/convert-to-ticket')
  @RequirePermission('M22', 'email-thread', 'CONVERT_TO_TICKET')
  convertToTicket(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.ticketConversion.convertToTicket(id, user.userId);
  }
}
