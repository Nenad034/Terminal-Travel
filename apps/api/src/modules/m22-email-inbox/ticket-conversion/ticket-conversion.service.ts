import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { MailboxesService } from '../mailboxes/mailboxes.service';
import { TicketsService } from '../../m14-helpdesk/tickets/tickets.service';

// M22 spec §8 — POST /threads/:id/convert-to-ticket, isti krug dozvole kao REPLY (M22 §7).
// Poziva M14 TicketsService.create() in-process preko DI (isti hibridni obrazac kao M21
// HelpQuestionsService §5.3/M13 FactSyncService) — M22 NIKAD ne piše direktno u Ticket tabelu.
@Injectable()
export class TicketConversionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly mailboxes: MailboxesService,
    private readonly tickets: TicketsService,
  ) {}

  async convertToTicket(threadId: string, actorUserId: string) {
    const thread = await this.prisma.emailThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException(`EmailThread ${threadId} nije pronađen.`);

    const access = await this.mailboxes.findAccess(thread.mailboxId, actorUserId);
    if (!access || access.accessLevel !== 'REPLY') {
      throw new ForbiddenException(`Konverzija u tiket zahteva REPLY MailboxAccess za sanduče ${thread.mailboxId} (§2.2).`);
    }

    const ticket = await this.tickets.create(
      {
        requesterClientAccountId: thread.correspondentClientAccountId ?? undefined,
        requesterType: thread.correspondentType === 'SUBAGENT' ? 'SUBAGENT' : 'GUEST',
        relatedBookingId: thread.relatedBookingId ?? undefined,
        subject: thread.subject,
        category: 'DRUGO',
        channel: 'EMAIL',
        sourceEmailThreadId: thread.id,
      },
      actorUserId,
    );

    const updatedThread = await this.prisma.emailThread.update({
      where: { id: threadId },
      data: { convertedToTicketId: ticket.id },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actorUserId,
      module: 'M22',
      action: 'email_thread.convert_to_ticket',
      resourceType: 'EmailThread',
      resourceId: threadId,
      afterState: updatedThread,
      context: { ticketId: ticket.id },
    });

    return { thread: updatedThread, ticket };
  }
}
