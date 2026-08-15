import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M19 spec §8 — REST prefiks /chat. Dozvole se ne proveravaju deklarativno preko
// @RequirePermission jer se grananje (DIRECT/GROUP vs EXTERNAL_SUPPLIER, STAFF vs
// SUPPLIER_CONTACT) razlikuje po tipu razgovora/pozivaocu — sprovedeno u ConversationsService
// (isti obrazac kao OmnisearchService/TicketsService koji rade sopstvenu, finiju proveru).
@ApiTags('chat-conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat/conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  findAll(@CurrentUser() user: { userId: string }) {
    return this.conversations.findAllForUser(user.userId);
  }

  @Post()
  create(@Body() dto: CreateConversationDto, @CurrentUser() user: { userId: string }) {
    return this.conversations.create(dto, user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.conversations.findOne(id, user.userId);
  }

  @Get(':id/messages')
  findMessages(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.conversations.findMessages(id, user.userId);
  }

  // §3/§8 — REST fallback za slanje (WS `message.send` je primaran kanal).
  @Post(':id/messages')
  createMessage(@Param('id') id: string, @Body() dto: CreateMessageDto, @CurrentUser() user: { userId: string }) {
    return this.conversations.createMessage(id, dto, user.userId);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.conversations.markRead(id, user.userId);
  }

  @Patch('messages/:messageId')
  editMessage(@Param('messageId') messageId: string, @Body() dto: UpdateMessageDto, @CurrentUser() user: { userId: string }) {
    return this.conversations.editMessage(messageId, dto, user.userId);
  }

  @Delete('messages/:messageId')
  deleteMessage(@Param('messageId') messageId: string, @CurrentUser() user: { userId: string }) {
    return this.conversations.deleteMessage(messageId, user.userId);
  }
}
