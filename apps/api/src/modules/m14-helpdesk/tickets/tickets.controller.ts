import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AgentActionGuard } from '../../../common/guards/agent-action.guard';
import { AgentAction } from '../../../common/decorators/agent-action.decorator';

// M14 spec §6, prefiks /api/v1/helpdesk
@ApiTags('helpdesk-tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, AgentActionGuard)
@Controller('helpdesk/tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  @RequirePermission('M14', 'ticket', 'VIEW')
  findMany(@CurrentUser() actor: { userId: string }, @Query('relatedBookingId') relatedBookingId?: string) {
    return this.tickets.findMany(actor.userId, { relatedBookingId });
  }

  @Post()
  @RequirePermission('M14', 'ticket', 'CREATE')
  create(@Body() dto: CreateTicketDto, @CurrentUser() actor: { userId: string }) {
    return this.tickets.create(dto, actor.userId);
  }

  @Get(':id')
  @RequirePermission('M14', 'ticket', 'VIEW')
  findOne(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.tickets.findOne(id, actor.userId);
  }

  // §6 — izmena statusa/prioriteta/dodele je uvek interna radnja (RESPOND), nikad Gost/subagent.
  @Patch(':id')
  @RequirePermission('M14', 'ticket', 'RESPOND')
  update(@Param('id') id: string, @Body() dto: UpdateTicketDto, @CurrentUser() actor: { userId: string }) {
    return this.tickets.update(id, dto, actor.userId);
  }

  @Get(':id/messages')
  @RequirePermission('M14', 'ticket', 'VIEW')
  findMessages(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.tickets.findMessages(id, actor.userId);
  }

  // §5 — CREATE dozvola pokriva i Gost/SUBAGENT_ADMIN (sopstveni REQUESTER odgovor); ograda za
  // STAFF/AI_DRAFT/internu belešku je u servisu (ownership provera), ne u samoj dozvoli.
  @Post(':id/messages')
  @RequirePermission('M14', 'ticket', 'CREATE')
  createMessage(@Param('id') id: string, @Body() dto: CreateTicketMessageDto, @CurrentUser() actor: { userId: string }) {
    return this.tickets.createMessage(id, dto, actor.userId);
  }

  @Post(':id/messages/:messageId/send')
  @RequirePermission('M14', 'ticket', 'RESPOND')
  @AgentAction('M14', 'ticket_response.send_with_price_or_obligation')
  sendMessage(@Param('id') id: string, @Param('messageId') messageId: string, @CurrentUser() actor: { userId: string }) {
    return this.tickets.sendMessage(id, messageId, actor);
  }
}
