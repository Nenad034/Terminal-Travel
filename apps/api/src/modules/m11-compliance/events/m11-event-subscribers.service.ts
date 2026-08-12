import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventListenerService } from '../../../common/events/event-listener.service';
import { TravelGuaranteeRegistrationsService } from '../travel-guarantee-registrations/travel-guarantee-registrations.service';

// M11 spec §2.3 — M11 se pretplaćuje na M5 booking.confirmed/booking.cancelled i za svaku
// ORGANIZATOR rezervaciju automatski kreira/oslobađa CIS registraciju garancije putovanja.
// Nivo "Autonomno" (Master dokument poglavlje 7) — deterministička priprema/skidanje, ne
// izmena same garancije. Isti obrazac kao M10EventSubscribersService.
@Injectable()
export class M11EventSubscribersService implements OnModuleInit {
  constructor(
    private readonly eventListener: EventListenerService,
    private readonly prisma: PrismaService,
    private readonly registrations: TravelGuaranteeRegistrationsService,
  ) {}

  onModuleInit(): void {
    this.eventListener.on('M5', 'booking.confirmed', async (payload) => {
      await this.onBookingConfirmed(payload.bookingId as string);
    });
    this.eventListener.on('M5', 'booking.cancelled', async (payload) => {
      await this.onBookingCancelled(payload.bookingId as string);
    });
  }

  async onBookingConfirmed(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.tipNastupanja !== 'ORGANIZATOR') return;
    await this.registrations.createForBooking(bookingId);
  }

  async onBookingCancelled(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.tipNastupanja !== 'ORGANIZATOR') return;
    await this.registrations.releaseForBooking(bookingId);
  }
}
