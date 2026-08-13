import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventBusService } from '../../../common/events/event-bus.service';

const ZZP_ESCALATION_DAYS = 5; // §3.1 — bez ijednog STAFF odgovora ovoliko dana od prijema

// M14 spec §3.1 — periodična provera: REKLAMACIJA tiket bez ijedne TicketMessage sa
// sender_type=STAFF i popunjenim sent_by, 5 dana od created_at, dobija zzp_escalated_at i
// obaveštava Vlasnika/Direktora. Nivo "Autonomno" (Master dokument poglavlje 7) — čisto
// informativna eskalacija preko Event Bus-a (M18 još ne postoji kao model, isti obrazac kao
// M10AlarmsService/M10 payment_deadline_missed).
@Injectable()
export class M14AlarmsService {
  private readonly logger = new Logger(M14AlarmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDailyChecks(): Promise<void> {
    await this.checkZzpEscalations();
  }

  async checkZzpEscalations(): Promise<number> {
    const threshold = new Date(Date.now() - ZZP_ESCALATION_DAYS * 24 * 60 * 60 * 1000);
    const candidates = await this.prisma.ticket.findMany({
      where: {
        category: 'REKLAMACIJA',
        zzpEscalatedAt: null,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        createdAt: { lte: threshold },
      },
    });

    let escalated = 0;
    for (const ticket of candidates) {
      const staffResponse = await this.prisma.ticketMessage.findFirst({
        where: { ticketId: ticket.id, senderType: 'STAFF', sentBy: { not: null } },
      });
      if (staffResponse) continue; // već odgovoreno — nema eskalacije

      const now = new Date();
      await this.prisma.ticket.update({ where: { id: ticket.id }, data: { zzpEscalatedAt: now } });
      await this.eventBus.emit('M14', 'ticket_zzp_escalated', {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        zzpResponseDeadline: ticket.zzpResponseDeadline,
      });
      escalated++;
    }
    return escalated;
  }
}
