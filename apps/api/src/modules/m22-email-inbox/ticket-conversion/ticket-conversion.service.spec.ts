import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TicketConversionService } from './ticket-conversion.service';

describe('TicketConversionService (M22 spec §8)', () => {
  function makeService() {
    const prisma = {
      emailThread: { findUnique: jest.fn(), update: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const mailboxes = { findAccess: jest.fn() };
    const tickets = { create: jest.fn() };
    const service = new TicketConversionService(prisma as any, auditLog as any, mailboxes as any, tickets as any);
    return { service, prisma, auditLog, mailboxes, tickets };
  }

  it('baca NotFoundException ako nit ne postoji', async () => {
    const { service, prisma } = makeService();
    prisma.emailThread.findUnique.mockResolvedValue(null);

    await expect(service.convertToTicket('nepostojeca', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('zahteva REPLY MailboxAccess (isti krug kao odgovaranje)', async () => {
    const { service, prisma, mailboxes } = makeService();
    prisma.emailThread.findUnique.mockResolvedValue({ id: 't1', mailboxId: 'mb-1' });
    mailboxes.findAccess.mockResolvedValue({ accessLevel: 'VIEW' });

    await expect(service.convertToTicket('t1', 'user-1')).rejects.toThrow(ForbiddenException);
  });

  it('kreira Ticket preko M14 TicketsService i upisuje reciprocno convertedToTicketId', async () => {
    const { service, prisma, mailboxes, tickets } = makeService();
    prisma.emailThread.findUnique.mockResolvedValue({
      id: 't1',
      mailboxId: 'mb-1',
      subject: 'Pitanje gosta',
      correspondentType: 'GUEST',
      correspondentClientAccountId: 'ca-1',
      relatedBookingId: null,
    });
    mailboxes.findAccess.mockResolvedValue({ accessLevel: 'REPLY' });
    tickets.create.mockResolvedValue({ id: 'ticket-1', ticketNumber: 'HD-2026-000001' });
    prisma.emailThread.update.mockResolvedValue({ id: 't1', convertedToTicketId: 'ticket-1' });

    const result = await service.convertToTicket('t1', 'user-1');

    expect(tickets.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Pitanje gosta',
        channel: 'EMAIL',
        sourceEmailThreadId: 't1',
        requesterClientAccountId: 'ca-1',
      }),
      'user-1',
    );
    expect(prisma.emailThread.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { convertedToTicketId: 'ticket-1' } });
    expect(result.ticket.id).toBe('ticket-1');
  });
});
