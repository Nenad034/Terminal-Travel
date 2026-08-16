import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MailboxesService } from './mailboxes.service';
import { CreateMailboxDto } from './dto/create-mailbox.dto';
import { GrantMailboxAccessDto } from './dto/grant-mailbox-access.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M22 spec §8 — /mailboxes, /mailboxes/:id/access. Ove rute NISU per-mailbox scoping (§2.2) —
// upravljanje konekcijama sandučadi i dodela pristupa je uže, samo Vlasnik/Direktor (§7).
@ApiTags('email-mailboxes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('email/mailboxes')
export class MailboxesController {
  constructor(private readonly mailboxes: MailboxesService) {}

  @Get()
  @RequirePermission('M22', 'mailbox', 'VIEW')
  findAll() {
    return this.mailboxes.findAll();
  }

  @Post()
  @RequirePermission('M22', 'mailbox', 'CREATE')
  create(@Body() dto: CreateMailboxDto, @CurrentUser() user: { userId: string }) {
    return this.mailboxes.create(dto, user.userId);
  }

  @Get(':id/access')
  @RequirePermission('M22', 'mailbox-access', 'GRANT')
  listAccess(@Param('id') id: string) {
    return this.mailboxes.listAccess(id);
  }

  @Post(':id/access')
  @RequirePermission('M22', 'mailbox-access', 'GRANT')
  grantAccess(@Param('id') id: string, @Body() dto: GrantMailboxAccessDto, @CurrentUser() user: { userId: string }) {
    return this.mailboxes.grantAccess(id, dto, user.userId);
  }
}
