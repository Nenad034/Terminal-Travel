import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventListenerService } from '../../../common/events/event-listener.service';
import { SubagentVolumeStatusService } from '../commission/subagent-volume-status.service';

// M7 spec §3.1 — "Automatski preračun: isti obrazac kao M6 lojalnost — pretplata na
// booking.confirmed/booking.cancelled iz M5 Event Bus-a." Isti obrazac kao M6EventSubscribersService.
@Injectable()
export class M7EventSubscribersService implements OnModuleInit {
  constructor(
    private readonly eventListener: EventListenerService,
    private readonly prisma: PrismaService,
    private readonly volumeStatus: SubagentVolumeStatusService,
  ) {}

  onModuleInit(): void {
    this.eventListener.on('M5', 'booking.confirmed', async (payload) => {
      await this.recalculateForBooking(payload.bookingId as string);
    });
    this.eventListener.on('M5', 'booking.cancelled', async (payload) => {
      await this.recalculateForBooking(payload.bookingId as string);
    });
  }

  private async recalculateForBooking(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return;
    const subagent = await this.prisma.subagent.findUnique({ where: { clientAccountId: booking.clientAccountId } });
    if (!subagent) return; // rezervacija nije od subagenta — ništa za preračun (M7 spec §3.1)
    await this.volumeStatus.recalculate(subagent.id);
  }
}
