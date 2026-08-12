import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventListenerService } from '../../../common/events/event-listener.service';
import { ClientLoyaltyStatusService } from '../loyalty/client-loyalty-status.service';
import { PostTripSurveysService } from '../post-trip-surveys/post-trip-surveys.service';

// M6 spec §3.2 (booking.confirmed/booking.cancelled → preračun lojalnosti) i §4.3
// (booking.completed → kreiranje PostTripSurvey). Isti obrazac kao M11EventSubscribersService.
@Injectable()
export class M6EventSubscribersService implements OnModuleInit {
  constructor(
    private readonly eventListener: EventListenerService,
    private readonly prisma: PrismaService,
    private readonly loyaltyStatus: ClientLoyaltyStatusService,
    private readonly postTripSurveys: PostTripSurveysService,
  ) {}

  onModuleInit(): void {
    this.eventListener.on('M5', 'booking.confirmed', async (payload) => {
      await this.recalculateLoyalty(payload.bookingId as string);
    });
    this.eventListener.on('M5', 'booking.cancelled', async (payload) => {
      await this.recalculateLoyalty(payload.bookingId as string);
    });
    this.eventListener.on('M5', 'booking.completed', async (payload) => {
      await this.postTripSurveys.createForBooking(payload.bookingId as string);
    });
  }

  private async recalculateLoyalty(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return;
    await this.loyaltyStatus.recalculate(booking.clientAccountId);
  }
}
