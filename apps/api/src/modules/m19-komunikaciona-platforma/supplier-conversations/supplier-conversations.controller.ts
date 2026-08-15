import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupplierConversationsService } from './supplier-conversations.service';
import { GrantAccessDto } from './dto/grant-access.dto';
import { InviteContactDto } from './dto/invite-contact.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M19 spec §9.7 — dozvola (M19/supplier-conversation/GRANT_ACCESS) se proverava u servisu (isti
// obrazac kao ConversationsController), ne deklarativno — sve tri rute dele istu proveru.
@ApiTags('chat-supplier-conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat/supplier-conversations')
export class SupplierConversationsController {
  constructor(private readonly supplierConversations: SupplierConversationsService) {}

  @Get(':id/access')
  listAccess(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.supplierConversations.listAccess(id, user.userId);
  }

  @Post(':id/access')
  grantAccess(@Param('id') id: string, @Body() dto: GrantAccessDto, @CurrentUser() user: { userId: string }) {
    return this.supplierConversations.grantAccess(id, dto, user.userId);
  }

  @Delete(':id/access/:userId')
  revokeAccess(@Param('id') id: string, @Param('userId') targetUserId: string, @CurrentUser() user: { userId: string }) {
    return this.supplierConversations.revokeAccess(id, targetUserId, user.userId);
  }

  @Post(':id/invite-contact')
  inviteContact(@Param('id') id: string, @Body() dto: InviteContactDto, @CurrentUser() user: { userId: string }) {
    return this.supplierConversations.inviteContact(id, dto, user.userId);
  }
}
